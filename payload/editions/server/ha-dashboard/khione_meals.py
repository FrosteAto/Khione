"""Khione Meals: 12-week recipe rotation, macros, weigh-in tracking.

Ported from the Glance-based glance-meals / glance-weight-server scripts.
Data lives under /config/meals/ (recipes.json, meal-plan.json,
weight-log.json, weight-profile.json) -- same shapes as the Glance
versions, so a straight file copy from /var/lib/glance/*.json carries
everything over.

Everything above the "pyscript glue" marker below is plain Python with no
pyscript dependency -- testable with a normal python3 interpreter. Only
the code below that marker uses pyscript's injected @service/@time_trigger
decorators and state.get/state.set/log globals, and only runs for real
inside the HA/pyscript runtime.
"""
import json
import os
import re
from datetime import date, datetime, timedelta

# pyscript requires blocking I/O (like plain open()) inside service/trigger
# functions to go through its executor so it doesn't stall the async event
# loop; outside pyscript (e.g. this file's own plain-Python test harness)
# that name doesn't exist, so fall back to a no-op decorator.
try:
    pyscript_executor
except NameError:
    def pyscript_executor(f):
        return f

DATA_DIR = "/config/meals"
RECIPES_PATH = f"{DATA_DIR}/recipes.json"
PLAN_PATH = f"{DATA_DIR}/meal-plan.json"
WEIGHT_LOG_PATH = f"{DATA_DIR}/weight-log.json"
WEIGHT_PROFILE_PATH = f"{DATA_DIR}/weight-profile.json"

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SLOTS = ("breakfast", "lunch", "snacks", "dinner")
MEAL_TYPES = ("breakfast", "lunch", "snack", "dinner")
MEAL_SLOTS = ("breakfast", "lunch", "snacks", "dinner")

START_KG = 90.0
GOAL_KG = 75.0
DEFAULT_PROFILE = {"age": 30, "height_cm": 183, "sex": "male", "activity": 1.375}
ACTIVITY_FACTORS = ("1.2", "1.375", "1.55", "1.725")

SEED_RECIPES = [
    # Breakfast
    {"id": "yoghurt-oats-fruit", "name": "Yoghurt + oats + fruit", "meal_type": "breakfast",
     "kcal_min": 315, "kcal_max": 315, "protein_min": 27, "protein_max": 27,
     "ingredients": "1 cup 0% Greek yoghurt, ⅓ cup oats, ½ banana or ½ cup berries.",
     "instructions": "Mix yoghurt, oats, and fruit in a bowl.", "batch": 0, "fresh": False},
    {"id": "protein-porridge-fruit", "name": "Porridge + fruit", "meal_type": "breakfast",
     "kcal_min": 345, "kcal_max": 345, "protein_min": 19, "protein_max": 19,
     "ingredients": "½ cup oats, 200ml semi-skimmed milk, 2 heaped tbsp 0% Greek yoghurt, ½ banana or ½ cup berries.",
     "instructions": "Cook oats with milk. Stir in yoghurt after cooking and top with fruit.", "batch": 0, "fresh": False},
    {"id": "marmite-toast-protein-side", "name": "Marmite on toast + milk or shake", "meal_type": "breakfast",
     "kcal_min": 305, "kcal_max": 365, "protein_min": 15, "protein_max": 25,
     "ingredients": "2 slices wholemeal bread, thin spreading of Marmite, 200ml semi-skimmed milk or 1 protein drink.",
     "instructions": "Toast bread, spread Marmite thinly, and have milk or a protein drink alongside.", "batch": 0, "fresh": False},
    {"id": "banana-cinnamon-protein-shake", "name": "Banana cinnamon protein shake", "meal_type": "breakfast",
     "kcal_min": 225, "kcal_max": 250, "protein_min": 25, "protein_max": 27,
     "ingredients": "1 banana, 1 scoop protein powder, ¼ tsp ground cinnamon, splash of water, ice (if using fresh banana).",
     "instructions": "Blend the banana, protein powder, cinnamon, a splash of water and a handful of ice until "
                      "smooth. Add a little more water if it's too thick to blend.",
     "batch": 0, "fresh": False},
    {"id": "mixed-berry-protein-shake", "name": "Mixed berry protein shake", "meal_type": "breakfast",
     "kcal_min": 180, "kcal_max": 220, "protein_min": 25, "protein_max": 27,
     "ingredients": "Small punnet fresh mixed berries (~125-150g), 1 scoop protein powder, splash of water, handful of ice.",
     "instructions": "Blend the berries, protein powder, a splash of water and a handful of ice until smooth.",
     "batch": 0, "fresh": False},
    {"id": "apple-cinnamon-protein-shake", "name": "Apple cinnamon protein shake", "meal_type": "breakfast",
     "kcal_min": 215, "kcal_max": 240, "protein_min": 25, "protein_max": 27,
     "ingredients": "1 apple, cored and chopped, 1 scoop protein powder, pinch of ground cinnamon, splash of water, handful of ice.",
     "instructions": "Blend the apple, protein powder, cinnamon, a splash of water and a handful of ice until smooth.",
     "batch": 0, "fresh": False},
    # Lunch
    {"id": "tuna-mayo-sandwich", "name": "Tuna mayo sandwich", "meal_type": "lunch",
     "kcal_min": 335, "kcal_max": 335, "protein_min": 35, "protein_max": 40,
     "ingredients": "2 slices wholemeal bread, 1 tin tuna in spring water, 1 tbsp light mayo, black pepper.",
     "instructions": "Drain tuna, mix with mayo and pepper, and make the sandwich.", "batch": 0, "fresh": False},
    {"id": "chicken-pickle-sandwich", "name": "Chicken + pickle sandwich", "meal_type": "lunch",
     "kcal_min": 330, "kcal_max": 380, "protein_min": 30, "protein_max": 35,
     "ingredients": "2 slices wholemeal bread, 100g cooked chicken slices, 1 tbsp pickle, optional cucumber or salad.",
     "instructions": "Layer chicken and pickle in the sandwich; add cucumber or salad if desired.", "batch": 0, "fresh": False},
    {"id": "hummus-chicken-salad-sandwich", "name": "Hummus + chicken salad sandwich", "meal_type": "lunch",
     "kcal_min": 350, "kcal_max": 400, "protein_min": 28, "protein_max": 32,
     "ingredients": "2 slices wholemeal bread, 1 heaped tbsp hummus, 75g cooked chicken, 1 handful salad.",
     "instructions": "Use hummus as the spread and add chicken plus salad.", "batch": 0, "fresh": False},
    {"id": "cheese-tomato-pickle-sandwich", "name": "Cheese + tomato/pickle sandwich", "meal_type": "lunch",
     "kcal_min": 315, "kcal_max": 315, "protein_min": 17, "protein_max": 17,
     "ingredients": "2 slices wholemeal bread, 30g reduced-fat cheddar, ½ tomato, 1 tbsp pickle, optional 200ml milk.",
     "instructions": "Slice tomato, add cheese and pickle, and serve with milk if extra protein is needed.", "batch": 0, "fresh": False},
    {"id": "marmite-cucumber-sandwich-protein-drink", "name": "Marmite + cucumber sandwich + shake", "meal_type": "lunch",
     "kcal_min": 310, "kcal_max": 370, "protein_min": 15, "protein_max": 25,
     "ingredients": "2 slices wholemeal bread, thin spreading of Marmite, ¼ cucumber, 1 protein drink.",
     "instructions": "Spread Marmite, add cucumber slices, and have a protein drink alongside.", "batch": 0, "fresh": False},
    # Snacks (bought items -- no real "ingredients", just a usage note)
    {"id": "protein-savoury-pack", "name": "Protein savoury pack", "meal_type": "snack",
     "kcal_min": 80, "kcal_max": 180, "protein_min": 10, "protein_max": 25,
     "ingredients": "", "instructions": "Jerky or chicken bite-style pack; convenient savoury protein.", "batch": 0, "fresh": False},
    {"id": "cereal-oat-bar", "name": "Cereal/oat bar", "meal_type": "snack",
     "kcal_min": 90, "kcal_max": 180, "protein_min": 2, "protein_max": 6,
     "ingredients": "", "instructions": "Useful pre-run carbohydrate snack.", "batch": 0, "fresh": False},
    {"id": "choc-biscuit-pack", "name": "Chocolate/biscuit pack", "meal_type": "snack",
     "kcal_min": 100, "kcal_max": 250, "protein_min": 1, "protein_max": 5,
     "ingredients": "", "instructions": "Treat option; keep portion-controlled.", "batch": 0, "fresh": False},
    {"id": "mini-cheddars-baked-crisps", "name": "Mini Cheddars/baked crisps", "meal_type": "snack",
     "kcal_min": 120, "kcal_max": 180, "protein_min": 3, "protein_max": 6,
     "ingredients": "", "instructions": "Savoury treat option for variety.", "batch": 0, "fresh": False},
    # Dinner
    {"id": "high-protein-chilli", "name": "Chilli", "meal_type": "dinner",
     "kcal_min": 520, "kcal_max": 560, "protein_min": 35, "protein_max": 40,
     "ingredients": "500g 5% beef mince, 1 tin chopped tomatoes, 1 tin kidney beans, 1 onion, 1 pepper, spinach, spices, rice.",
     "instructions": "Cook mince, onion, and pepper. Add tomatoes, beans, spices, and spinach. Serve with ½ cup cooked rice.",
     "batch": 4, "fresh": False},
    {"id": "high-protein-bolognese", "name": "Bolognese", "meal_type": "dinner",
     "kcal_min": 500, "kcal_max": 540, "protein_min": 35, "protein_max": 40,
     "ingredients": "500g 5% beef mince, 1 tin chopped tomatoes, 1 onion, spinach, herbs, 300g dry pasta total.",
     "instructions": "Cook mince and onion, add tomatoes, herbs, and spinach. Serve with 75g dry pasta per portion.",
     "batch": 4, "fresh": False},
    {"id": "chicken-curry", "name": "Chicken curry", "meal_type": "dinner",
     "kcal_min": 520, "kcal_max": 580, "protein_min": 45, "protein_max": 50,
     "ingredients": "700g chicken breast, 1 onion, 1 tin chopped tomatoes, spinach, curry paste/sauce, low-fat yoghurt, rice.",
     "instructions": "Cook chicken and onion, add tomatoes and curry paste. Stir in yoghurt at the end and serve with ½ cup cooked rice.",
     "batch": 4, "fresh": False},
    {"id": "salmon-potatoes-veg", "name": "Salmon + potatoes + veg", "meal_type": "dinner",
     "kcal_min": 500, "kcal_max": 620, "protein_min": 28, "protein_max": 45,
     "ingredients": "1 salmon fillet, 250g potatoes, 1½ cups vegetables, 1 tsp olive oil.",
     "instructions": "Cook salmon, boil or bake potatoes, and serve with a large portion of vegetables.",
     "batch": 3, "fresh": True},
    {"id": "japanese-chicken-curry", "name": "Japanese chicken curry", "meal_type": "dinner",
     "kcal_min": 620, "kcal_max": 700, "protein_min": 45, "protein_max": 50,
     "ingredients": "700g chicken breast, ½ block Japanese curry mix, onion, carrots, potatoes, spinach, rice.",
     "instructions": "Simmer chicken, onion, carrots, and potatoes. Add curry block and spinach, then serve with ½ cup cooked rice.",
     "batch": 4, "fresh": False},
    {"id": "tuna-pesto-pasta", "name": "Tuna pesto pasta", "meal_type": "dinner",
     "kcal_min": 520, "kcal_max": 580, "protein_min": 38, "protein_max": 45,
     "ingredients": "75g dry pasta, 2 tbsp reduced-fat pesto, spinach, tomato, 1 tin tuna.",
     "instructions": "Cook pasta, stir through pesto, spinach, and tomato, then add drained tuna.",
     "batch": 3, "fresh": False},
    {"id": "baked-potato-tuna", "name": "Baked potato with tuna", "meal_type": "dinner",
     "kcal_min": 400, "kcal_max": 500, "protein_min": 35, "protein_max": 45,
     "ingredients": "1 large potato, 1 tin tuna, 1 tbsp light mayo, ¼ small red onion, salad/veg.",
     "instructions": "Bake or microwave the potato, mix tuna with mayo and onion, and serve with salad or vegetables.",
     "batch": 3, "fresh": True},
    {"id": "sausage-tray-bake-beans", "name": "Sausage tray bake + beans", "meal_type": "dinner",
     "kcal_min": 540, "kcal_max": 680, "protein_min": 20, "protein_max": 32,
     "ingredients": "2 reduced-fat sausages, 250g potatoes, carrot, ½ onion, ½ pepper, 1 tsp olive oil, ½ tin beans.",
     "instructions": "Roast sausages and vegetables with oil, then serve with ½ tin beans.",
     "batch": 3, "fresh": False},
    {"id": "tortelloni-tomato-lentils-beans", "name": "Tortelloni with tomato + lentils/beans", "meal_type": "dinner",
     "kcal_min": 560, "kcal_max": 650, "protein_min": 25, "protein_max": 35,
     "ingredients": "½ pack tortelloni, tomato sauce/chopped tomatoes, spinach, ½ tin drained lentils or beans.",
     "instructions": "Boil tortelloni, heat sauce with spinach and lentils/beans, then combine.",
     "batch": 3, "fresh": True},
    {"id": "greek-yoghurt-tuna-pasta-salad", "name": "Greek yoghurt tuna pasta salad", "meal_type": "dinner",
     "kcal_min": 500, "kcal_max": 540, "protein_min": 38, "protein_max": 42,
     "ingredients": "225g dry pasta, 2 tins tuna in spring water, 165g 0% Greek yoghurt, 1 tbsp light mayo, "
                     "⅓ cucumber, 200g cherry tomatoes, ½ small red onion, black pepper, garlic powder, paprika, "
                     "optional squeeze of lemon juice.",
     "instructions": "Cook the pasta and allow it to cool. Mix together the Greek yoghurt, mayo, garlic powder, "
                      "paprika, black pepper and optional lemon juice. Stir through the pasta, drained tuna, "
                      "diced cucumber, halved tomatoes and finely diced red onion. Chill before serving.",
     "batch": 3, "fresh": True},
    {"id": "chicken-fajita-rice-bowls", "name": "Chicken fajita rice bowls", "meal_type": "dinner",
     "kcal_min": 510, "kcal_max": 560, "protein_min": 45, "protein_max": 50,
     "ingredients": "700g chicken breast, 300g dry rice, 2 onions, 3 bell peppers, 1 tbsp olive oil, "
                     "1 packet fajita seasoning, optional lime juice and fresh coriander.",
     "instructions": "Cook the rice. Slice the chicken, onions and peppers. Fry the chicken in the oil until "
                      "browned, then add the onions, peppers and fajita seasoning with a splash of water. Cook "
                      "until the vegetables soften and the chicken is cooked through. Serve over the rice with "
                      "optional lime juice and coriander.",
     "batch": 4, "fresh": True},
    {"id": "spam-rice-bowl", "name": "Sweet & sticky Spam rice bowl", "meal_type": "dinner",
     "kcal_min": 580, "kcal_max": 620, "protein_min": 23, "protein_max": 26,
     "ingredients": "2 tins Spam, 300g dry rice, 2 onions, 2 bell peppers, 300g mushrooms, 4 cloves garlic, "
                     "4 tbsp light soy sauce, 2 tbsp brown sugar, 2 tsp sriracha (optional), "
                     "2 tsp sesame or vegetable oil.",
     "instructions": "Cook the rice. Fry the onion, pepper, mushrooms and garlic until softened, then remove "
                      "from the pan. Brown the Spam slices, add the soy sauce, brown sugar and optional "
                      "sriracha, cooking until the glaze thickens. Return the vegetables, toss together, and "
                      "serve over the rice.",
     "batch": 4, "fresh": True},
    {"id": "beef-bean-freezer-wraps", "name": "Beef & bean freezer wraps", "meal_type": "dinner",
     "kcal_min": 460, "kcal_max": 480, "protein_min": 42, "protein_max": 44,
     "ingredients": "1kg beef mince, 1 onion, 2 tins black beans, 2 tins chopped tomatoes, 1 tin sweetcorn, "
                     "2 sachets taco seasoning, jarred sliced jalapeños to taste, 8 large tortilla wraps (uses 7).",
     "instructions": "Brown the mince with onion, stir in the beans, tomatoes, corn, taco seasoning and "
                      "jalapeños, and simmer until thick. Cool, divide between 7 wraps, roll tightly, and "
                      "freeze individually. Microwave from frozen to reheat.",
     "batch": 7, "fresh": False},
    {"id": "beef-cheese-freezer-wraps", "name": "Beef & cheese freezer wraps", "meal_type": "dinner",
     "kcal_min": 510, "kcal_max": 530, "protein_min": 46, "protein_max": 48,
     "ingredients": "1kg beef mince, 1 onion, 1 tin chopped tomatoes, dried oregano, garlic powder, black "
                     "pepper, 5 Laughing Cow cheese wedges, 200g reduced-fat mozzarella (use ~140g), "
                     "8 large tortilla wraps (uses 7).",
     "instructions": "Brown the mince with onion, tomatoes and herbs, then stir through both cheeses until "
                      "melted and creamy. Cool, divide between 7 wraps, roll tightly, and freeze individually. "
                      "Microwave from frozen to reheat.",
     "batch": 7, "fresh": False},
    {"id": "beef-keema-curry-wraps", "name": "Beef keema curry wraps", "meal_type": "dinner",
     "kcal_min": 480, "kcal_max": 520, "protein_min": 40, "protein_max": 44,
     "ingredients": "1kg beef mince, 2 onions, garlic and ginger paste, 7 tbsp curry paste, ~260g frozen peas, "
                     "700g/700ml passata, 5 tbsp mango chutney, 8 large tortilla wraps (uses 7).",
     "instructions": "Soften the onion, garlic and ginger, stir in the curry paste, then brown the mince. Add "
                      "the peas, passata and mango chutney and simmer until thick. Cool, divide between 7 "
                      "wraps, roll tightly, and freeze individually. Microwave from frozen to reheat.",
     "batch": 7, "fresh": False},
    {"id": "teriyaki-beef-wraps", "name": "Teriyaki beef wraps", "meal_type": "dinner",
     "kcal_min": 430, "kcal_max": 470, "protein_min": 38, "protein_max": 42,
     "ingredients": "1kg beef mince, 500g bag frozen stir-fry vegetables, 100ml soy sauce, 3-4 tbsp brown "
                     "sugar, garlic and ginger paste, 1 tsp sesame oil, 1 tbsp cornflour, 8 large tortilla "
                     "wraps (uses 7).",
     "instructions": "Brown the mince, stir in the frozen vegetables and cook until tender with most moisture "
                      "gone. Add soy sauce, brown sugar, garlic, ginger and sesame oil, then thicken with a "
                      "cornflour slurry until it coats everything and isn't wet. Cool, divide between 7 wraps, "
                      "roll tightly, and freeze individually. Microwave from frozen to reheat.",
     "batch": 7, "fresh": False},
    {"id": "hoisin-chicken-wraps", "name": "Hoisin chicken wraps", "meal_type": "dinner",
     "kcal_min": 420, "kcal_max": 460, "protein_min": 38, "protein_max": 42,
     "ingredients": "1kg boneless skinless chicken thighs, diced, 500g bag frozen stir-fry vegetables, 4-5 "
                     "tbsp hoisin sauce, splash dark soy sauce, 1 tsp Chinese five-spice, garlic and ginger "
                     "paste, 8 large tortilla wraps (uses 7).",
     "instructions": "Fry the diced chicken thigh with garlic, ginger and five-spice until cooked through. Add "
                      "the frozen vegetables and cook until tender with most moisture gone. Stir in the hoisin "
                      "and soy sauce until thick and coating. Cool, divide between 7 wraps, roll tightly, and "
                      "freeze individually. Microwave from frozen to reheat.",
     "batch": 7, "fresh": False},
    {"id": "piri-piri-chicken-wraps", "name": "Piri piri chicken wraps", "meal_type": "dinner",
     "kcal_min": 420, "kcal_max": 460, "protein_min": 40, "protein_max": 44,
     "ingredients": "1kg boneless skinless chicken thighs, diced, 1 onion, garlic paste, peri-peri seasoning, "
                     "peri-peri marinade, 200g light soft cheese, 8 large tortilla wraps (uses 7).",
     "instructions": "Fry the diced chicken thigh with onion and garlic, season generously with peri-peri "
                      "seasoning, and cook through. Stir in the soft cheese and peri-peri marinade until "
                      "creamy and coating. Cool, divide between 7 wraps, roll tightly, and freeze individually. "
                      "Microwave from frozen to reheat, stirring the filling once hot if the cheese sauce "
                      "looks grainy.",
     "batch": 7, "fresh": False},
]

SEED_PLAN = {
    "week1_monday": "2026-07-13",
    "weeks": {
        "1": [
            {"days": ["Mon", "Tue", "Wed", "Thu"], "breakfast": ["yoghurt-oats-fruit"], "lunch": ["tuna-mayo-sandwich"],
             "snacks": ["protein-savoury-pack"], "dinner": ["high-protein-chilli"]},
            {"days": ["Fri", "Sat", "Sun"], "breakfast": ["yoghurt-oats-fruit"], "lunch": ["tuna-mayo-sandwich"],
             "snacks": ["protein-savoury-pack"], "dinner": ["tuna-pesto-pasta"]},
        ],
        "2": [
            {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "breakfast": ["banana-cinnamon-protein-shake"],
             "lunch": ["tuna-mayo-sandwich"], "snacks": ["cereal-oat-bar"],
             "dinner": ["beef-bean-freezer-wraps"]},
        ],
        "3": [
            {"days": ["Mon", "Tue", "Wed", "Thu"], "breakfast": ["protein-porridge-fruit"], "lunch": ["chicken-pickle-sandwich"],
             "snacks": ["choc-biscuit-pack"], "dinner": ["chicken-curry"]},
            {"days": ["Fri", "Sat", "Sun"], "breakfast": ["protein-porridge-fruit"], "lunch": ["chicken-pickle-sandwich"],
             "snacks": ["choc-biscuit-pack"], "dinner": ["tortelloni-tomato-lentils-beans"]},
        ],
        "4": [
            {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "breakfast": ["mixed-berry-protein-shake"],
             "lunch": ["chicken-pickle-sandwich"], "snacks": ["mini-cheddars-baked-crisps"],
             "dinner": ["beef-cheese-freezer-wraps"]},
        ],
        "5": [
            {"days": ["Mon", "Tue", "Wed"], "breakfast": ["yoghurt-oats-fruit"], "lunch": ["hummus-chicken-salad-sandwich"],
             "snacks": ["protein-savoury-pack"], "dinner": ["salmon-potatoes-veg"]},
            {"days": ["Thu", "Fri", "Sat", "Sun"], "breakfast": ["yoghurt-oats-fruit"], "lunch": ["hummus-chicken-salad-sandwich"],
             "snacks": ["protein-savoury-pack"], "dinner": ["high-protein-bolognese"]},
        ],
        "6": [
            {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "breakfast": ["apple-cinnamon-protein-shake"],
             "lunch": ["hummus-chicken-salad-sandwich"], "snacks": ["cereal-oat-bar"],
             "dinner": ["beef-keema-curry-wraps"]},
        ],
        "7": [
            {"days": ["Mon", "Tue", "Wed", "Thu"], "breakfast": ["marmite-toast-protein-side"], "lunch": ["tuna-mayo-sandwich"],
             "snacks": ["choc-biscuit-pack"], "dinner": ["japanese-chicken-curry"]},
            {"days": ["Fri", "Sat", "Sun"], "breakfast": ["marmite-toast-protein-side"], "lunch": ["tuna-mayo-sandwich"],
             "snacks": ["choc-biscuit-pack"], "dinner": ["sausage-tray-bake-beans"]},
        ],
        "8": [
            {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "breakfast": ["apple-cinnamon-protein-shake"],
             "lunch": ["tuna-mayo-sandwich"], "snacks": ["mini-cheddars-baked-crisps"],
             "dinner": ["teriyaki-beef-wraps"]},
        ],
        "9": [
            {"days": ["Mon", "Tue", "Wed", "Thu"], "breakfast": ["yoghurt-oats-fruit"], "lunch": ["marmite-cucumber-sandwich-protein-drink"],
             "snacks": ["protein-savoury-pack"], "dinner": ["chicken-fajita-rice-bowls"]},
            {"days": ["Fri", "Sat", "Sun"], "breakfast": ["yoghurt-oats-fruit"], "lunch": ["marmite-cucumber-sandwich-protein-drink"],
             "snacks": ["protein-savoury-pack"], "dinner": ["baked-potato-tuna"]},
        ],
        "10": [
            {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "breakfast": ["mixed-berry-protein-shake"],
             "lunch": ["marmite-cucumber-sandwich-protein-drink"], "snacks": ["cereal-oat-bar"],
             "dinner": ["hoisin-chicken-wraps"]},
        ],
        "11": [
            {"days": ["Mon", "Tue", "Wed", "Thu"], "breakfast": ["protein-porridge-fruit"], "lunch": ["chicken-pickle-sandwich"],
             "snacks": ["choc-biscuit-pack"], "dinner": ["spam-rice-bowl"]},
            {"days": ["Fri", "Sat", "Sun"], "breakfast": ["protein-porridge-fruit"], "lunch": ["chicken-pickle-sandwich"],
             "snacks": ["choc-biscuit-pack"], "dinner": ["greek-yoghurt-tuna-pasta-salad"]},
        ],
        "12": [
            {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "breakfast": ["banana-cinnamon-protein-shake"],
             "lunch": ["chicken-pickle-sandwich"], "snacks": ["mini-cheddars-baked-crisps"],
             "dinner": ["piri-piri-chicken-wraps"]},
        ],
    },
    "shopping": {
        "1": {"breakfast": ["2 × 500g tubs 0% Greek yoghurt", "1 bag oats", "7 bananas or 2 berry punnets"],
              "lunch": ["1 loaf wholemeal bread", "7 tins tuna in spring water", "1 bottle/jar light mayo", "Black pepper"],
              "snacks": ["7 protein savoury packs"],
              "dinner": ["500g 5% beef mince", "1 tin chopped tomatoes", "1 tin kidney beans", "1 onion", "1 bell pepper",
                         "1 bag spinach", "1 bag rice", "1 bag dry pasta", "1 jar reduced-fat pesto", "2 medium tomatoes",
                         "Cumin", "Smoked paprika", "Chilli flakes"]},
        "2": {"breakfast": ["7 bananas", "Ground cinnamon", "Protein powder (from your tub)"],
              "lunch": ["1 loaf wholemeal bread", "7 tins tuna in spring water", "1 bottle/jar light mayo", "Black pepper"],
              "snacks": ["1 multipack cereal/oat bars"],
              "dinner": ["2 × 500g lean beef mince", "1 onion", "2 tins black beans", "2 tins chopped tomatoes",
                         "1 tin sweetcorn", "2 sachets taco seasoning", "1 jar sliced jalapeños",
                         "1 × 8-pack large tortilla wraps"]},
        "3": {"breakfast": ["1 bag oats", "2 litres semi-skimmed milk", "1 × 500g tub 0% Greek yoghurt", "7 bananas or berries"],
              "lunch": ["1 loaf wholemeal bread", "700g cooked chicken slices", "1 jar pickle", "1 cucumber or 1 bag salad"],
              "snacks": ["1 multipack small chocolate bars/biscuit packs"],
              "dinner": ["700g chicken breast", "1 onion", "3 tins chopped tomatoes", "1 bag spinach",
                         "1 jar curry paste or lower-calorie curry sauce", "1 small tub low-fat yoghurt", "1 bag rice",
                         "2 × 300g packs tortelloni", "2 tins lentils/cannellini beans", "Black pepper"]},
        "4": {"breakfast": ["2-3 punnets fresh mixed berries", "Protein powder (from your tub)"],
              "lunch": ["1 loaf wholemeal bread", "700g cooked chicken slices", "1 jar pickle", "1 cucumber or 1 bag salad"],
              "snacks": ["1 multipack Mini Cheddars/baked crisps"],
              "dinner": ["2 × 500g lean beef mince", "1 onion", "1 tin chopped tomatoes",
                         "Dried oregano, garlic powder, black pepper", "1 box Laughing Cow cheese wedges",
                         "1 × 200g reduced-fat mozzarella", "1 × 8-pack large tortilla wraps"]},
        "5": {"breakfast": ["2 × 500g tubs 0% Greek yoghurt", "1 bag oats", "7 bananas or berries"],
              "lunch": ["1 loaf wholemeal bread", "1 × 300g tub hummus", "525–700g cooked chicken slices",
                        "1–2 bags salad", "1 cucumber"],
              "snacks": ["7 protein savoury packs"],
              "dinner": ["3 salmon fillets", "1.5–2kg potatoes", "Broccoli/peas/spinach", "Olive oil", "500g 5% beef mince",
                         "1 tin chopped tomatoes", "1 onion", "1 bag spinach", "1 bag dry pasta", "Italian herbs", "Black pepper"]},
        "6": {"breakfast": ["7 apples", "Ground cinnamon", "Protein powder (from your tub)"],
              "lunch": ["1 loaf wholemeal bread", "1 × 300g tub hummus", "525–700g cooked chicken slices",
                        "1–2 bags salad", "1 cucumber"],
              "snacks": ["1 multipack cereal/oat bars"],
              "dinner": ["2 × 500g lean beef mince", "2 onions", "Garlic and ginger paste", "1 jar curry paste",
                         "1 × 300g bag frozen peas", "700g/700ml passata", "1 jar mango chutney",
                         "1 × 8-pack large tortilla wraps"]},
        "7": {"breakfast": ["2 loaves wholemeal bread", "1 jar Marmite", "2 litres semi-skimmed milk or 7 protein drinks"],
              "lunch": ["7 tins tuna in spring water", "1 bottle/jar light mayo", "Black pepper"],
              "snacks": ["1 multipack small chocolate bars/biscuit packs"],
              "dinner": ["700g chicken breast", "1 box Japanese curry block", "2 onions", "1 bag carrots", "1.5–2kg potatoes",
                         "1 bag spinach", "1 bag rice", "6 reduced-fat sausages", "2 bell peppers",
                         "2 tins baked or mixed beans", "Olive oil"]},
        "8": {"breakfast": ["7 apples", "Ground cinnamon", "Protein powder (from your tub)"],
              "lunch": ["7 tins tuna in spring water", "1 bottle/jar light mayo", "Black pepper"],
              "snacks": ["1 multipack Mini Cheddars/baked crisps"],
              "dinner": ["2 × 500g lean beef mince", "1 × 500g bag frozen stir-fry vegetables", "1 bottle soy sauce",
                         "Brown sugar", "Garlic and ginger paste", "Sesame oil", "Cornflour",
                         "1 × 8-pack large tortilla wraps"]},
        "9": {"breakfast": ["2 × 500g tubs 0% Greek yoghurt", "1 bag oats", "7 bananas or 2 berry punnets"],
              "lunch": ["1 loaf wholemeal bread", "1 jar Marmite", "2 cucumbers", "7 protein drinks"],
              "snacks": ["7 protein savoury packs"],
              "dinner": ["700g chicken breast", "1 bag rice", "2 onions", "3 bell peppers", "1 packet fajita seasoning",
                         "Olive oil", "3 large potatoes", "3 tins tuna in spring water", "1 bottle/jar light mayo",
                         "1 small red onion", "1–2 bags salad or mixed veg"]},
        "10": {"breakfast": ["2-3 punnets fresh mixed berries", "Protein powder (from your tub)"],
               "lunch": ["1 loaf wholemeal bread", "1 jar Marmite", "2 cucumbers", "7 protein drinks"],
               "snacks": ["1 multipack cereal/oat bars"],
               "dinner": ["2 × 500g boneless skinless chicken thighs", "1 × 500g bag frozen stir-fry vegetables",
                          "1 jar hoisin sauce", "1 bottle dark soy sauce", "Chinese five-spice",
                          "Garlic and ginger paste", "1 × 8-pack large tortilla wraps"]},
        "11": {"breakfast": ["1 bag oats", "2 litres semi-skimmed milk", "1 × 500g tub 0% Greek yoghurt", "7 bananas or berries"],
               "lunch": ["1 loaf wholemeal bread", "700g cooked chicken slices", "1 jar pickle", "1 cucumber or 1 bag salad"],
               "snacks": ["1 multipack small chocolate bars/biscuit packs"],
               "dinner": ["2 tins Spam", "1 bag rice", "2 onions", "2 bell peppers", "1 pack mushrooms", "1 bulb garlic",
                          "1 bottle light soy sauce", "Brown sugar", "Sriracha (optional)", "Sesame or vegetable oil",
                          "1 bag dry pasta", "2 tins tuna in spring water", "1 small tub 0% Greek yoghurt",
                          "1 bottle/jar light mayo", "1 cucumber", "1 punnet cherry tomatoes", "1 small red onion",
                          "Garlic powder", "Paprika", "Black pepper"]},
        "12": {"breakfast": ["7 bananas", "Ground cinnamon", "Protein powder (from your tub)"],
               "lunch": ["1 loaf wholemeal bread", "700g cooked chicken slices", "1 jar pickle", "1 cucumber or 1 bag salad"],
               "snacks": ["1 multipack Mini Cheddars/baked crisps"],
               "dinner": ["2 × 500g boneless skinless chicken thighs", "1 onion", "Garlic paste", "Peri-peri seasoning",
                          "1 bottle peri-peri marinade", "1 × 200g light soft cheese (e.g. Philadelphia Light)",
                          "1 × 8-pack large tortilla wraps"]},
    },
}


@pyscript_executor
def write_json(path, data, indent=2):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)
    os.replace(tmp, path)


@pyscript_executor
def load_json(path, default=None):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def ensure_seed_data():
    if not os.path.exists(RECIPES_PATH):
        write_json(RECIPES_PATH, {"recipes": SEED_RECIPES})
    if not os.path.exists(PLAN_PATH):
        write_json(PLAN_PATH, SEED_PLAN)


def load_recipes():
    return load_json(RECIPES_PATH, {"recipes": []})["recipes"]


def load_plan():
    return load_json(PLAN_PATH, SEED_PLAN)


def midpoint(lo, hi):
    return round((lo + hi) / 2)


def macro_detail(r):
    kcal = f"{r['kcal_min']}" if r["kcal_min"] == r["kcal_max"] else f"{r['kcal_min']}–{r['kcal_max']}"
    protein = f"{r['protein_min']}" if r["protein_min"] == r["protein_max"] else f"{r['protein_min']}–{r['protein_max']}"
    return f"~{kcal} kcal · ~{protein}g protein"


def week_for(day, plan):
    week1_monday = date.fromisoformat(plan["week1_monday"])
    total_weeks = len(plan["weeks"])
    return ((day - week1_monday).days // 7) % total_weeks + 1


def day_span(plan, week_num, day_name):
    for span in plan["weeks"][str(week_num)]:
        if day_name in span["days"]:
            return span
    raise KeyError(day_name)


def span_for(day, plan):
    day_name = DAY_NAMES[day.weekday()]
    week_num = week_for(day, plan)
    return day_span(plan, week_num, day_name), week_num


def slot_names(ids, recipes_by_id):
    return " + ".join([recipes_by_id[i]["name"] for i in ids])


def slot_macros(ids, recipes_by_id):
    kcal = sum([midpoint(recipes_by_id[i]["kcal_min"], recipes_by_id[i]["kcal_max"]) for i in ids])
    protein = sum([midpoint(recipes_by_id[i]["protein_min"], recipes_by_id[i]["protein_max"]) for i in ids])
    return kcal, protein


def dinner_status(day, plan, recipes_by_id):
    span, _ = span_for(day, plan)
    day_name = DAY_NAMES[day.weekday()]
    position = span["days"].index(day_name)
    info = recipes_by_id[span["dinner"][0]]
    if info["fresh"]:
        return "cook", "COOK FRESH TONIGHT"
    if position == 0:
        return "cook", f"COOK NIGHT · MAKES {info['batch']}"
    return "leftovers", f"LEFTOVERS · PORTION {position + 1} OF {info['batch']}"


def week_view(target_week, actual_week, today_day_idx, plan, recipes_by_id):
    total_weeks = len(plan["weeks"])
    is_current = target_week == actual_week
    return {
        "week": target_week,
        "total_weeks": total_weeks,
        "actual_current_week": actual_week,
        "is_current": is_current,
        "next_week": target_week % total_weeks + 1,
        "prev_week": (target_week - 2) % total_weeks + 1,
        "days": [{"name": name,
                  "is_today": is_current and i == today_day_idx,
                  **{slot: slot_names(day_span(plan, target_week, name)[slot], recipes_by_id) for slot in SLOTS}}
                 for i, name in enumerate(DAY_NAMES)],
        **{f"shopping_{section}": items
           for section, items in plan["shopping"][str(target_week)].items()},
    }


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "recipe"


def unique_id(base, existing_ids):
    if base not in existing_ids:
        return base
    n = 2
    while f"{base}-{n}" in existing_ids:
        n += 1
    return f"{base}-{n}"


def recipe_in_use(recipe_id, plan):
    return any([recipe_id in span.get(slot, [])
                for spans in plan.get("weeks", {}).values()
                for span in spans
                for slot in MEAL_SLOTS])


def maintenance_kcal(kg, profile):
    bmr = (10 * kg + 6.25 * profile["height_cm"] - 5 * profile["age"]
           + (5 if profile["sex"] == "male" else -161))
    return int(round(bmr * float(profile["activity"]) / 10) * 10)


def load_profile():
    profile = dict(DEFAULT_PROFILE)
    saved = load_json(WEIGHT_PROFILE_PATH)
    if saved:
        profile.update(saved)
    return profile


def pretty_date(iso):
    return datetime.strptime(iso, "%Y-%m-%d").strftime("%-d %b %Y")


def weight_view(entries, profile):
    entries = sorted(entries, key=lambda e: e["date"])
    if not entries:
        return {"configured": False, "profile_age": profile["age"],
                "profile_height": profile["height_cm"], "profile_sex": profile["sex"],
                "profile_activity": str(profile["activity"])}
    current = entries[-1]
    return {
        "configured": True,
        "current": current["kg"],
        "current_date": pretty_date(current["date"]),
        "previous": [{"kg": e["kg"], "date": pretty_date(e["date"])} for e in entries[-4:-1]],
        "lost": round(START_KG - current["kg"], 1),
        "to_go": round(current["kg"] - GOAL_KG, 1),
        "percent": max(0, min(100, round((START_KG - current["kg"]) / (START_KG - GOAL_KG) * 100))),
        "maint": maintenance_kcal(current["kg"], profile),
        "profile_age": profile["age"], "profile_height": profile["height_cm"],
        "profile_sex": profile["sex"], "profile_activity": str(profile["activity"]),
    }


# ---------------------------------------------------------------------------
# pyscript glue -- only runs inside the real pyscript/HA runtime. Everything
# above this line is plain Python, independently tested in Task 1.
# ---------------------------------------------------------------------------

ensure_seed_data()


def _recompute_today():
    recipes = load_recipes()
    recipes_by_id = {r["id"]: r for r in recipes}
    plan = load_plan()
    today = date.today()
    actual_week = week_for(today, plan)
    today_span, _ = span_for(today, plan)
    kcal = sum([slot_macros(today_span[slot], recipes_by_id)[0] for slot in SLOTS])
    protein = sum([slot_macros(today_span[slot], recipes_by_id)[1] for slot in SLOTS])
    dinner_recipe = recipes_by_id[today_span["dinner"][0]]
    kind, status = dinner_status(today, plan, recipes_by_id)
    tomorrow = today + timedelta(days=1)
    tomorrow_span, _ = span_for(tomorrow, plan)
    tomorrow_kind, _ = dinner_status(tomorrow, plan, recipes_by_id)
    tomorrow_recipe = recipes_by_id[tomorrow_span["dinner"][0]]
    tomorrow_label = f"{tomorrow_recipe['name']} ({'cooking' if tomorrow_kind == 'cook' else 'leftovers'})"

    state.set("sensor.khione_meals_today", today.strftime("%A"), new_attributes={
        "week": actual_week, "total_weeks": len(plan["weeks"]),
        "breakfast": slot_names(today_span["breakfast"], recipes_by_id),
        "lunch": slot_names(today_span["lunch"], recipes_by_id),
        "snacks": slot_names(today_span["snacks"], recipes_by_id),
        "dinner": slot_names(today_span["dinner"], recipes_by_id),
        "kcal": kcal, "kcal_percent": min(100, round(kcal / 1800 * 100)),
        "protein": protein, "protein_percent": min(100, round(protein / 120 * 100)),
    })
    state.set("sensor.khione_meals_tonight", dinner_recipe["name"], new_attributes={
        "kind": kind, "status": status, "detail": macro_detail(dinner_recipe),
        "ingredients": dinner_recipe["ingredients"], "instructions": dinner_recipe["instructions"],
        "tomorrow": tomorrow_label,
    })
    today_day_idx = today.weekday()
    week_data = week_view(actual_week, actual_week, today_day_idx, plan, recipes_by_id)
    state.set("sensor.khione_meals_week", actual_week, new_attributes=week_data)

    for key, meal_type in (("breakfast", "breakfast"), ("lunch", "lunch"),
                           ("snacks", "snack"), ("dinner", "dinner")):
        matching = [r for r in recipes if r["meal_type"] == meal_type]
        state.set(f"sensor.khione_meals_recipes_{key}", len(matching), new_attributes={
            "recipes": [{
                "id": r["id"], "name": r["name"],
                "detail": macro_detail(r), "ingredients": r["ingredients"],
                "instructions": r["instructions"], "batch": r["batch"], "fresh": r["fresh"],
                # khione_meals_delete_recipe refuses (silent log.error +
                # return, no exception -- same convention as every other
                # service in this file) to delete a recipe still used in
                # the plan. Expose that here so the Recipes panel can
                # block Delete client-side instead of showing a false
                # "Deleted" success.
                "in_use": recipe_in_use(r["id"], plan),
            } for r in matching]
        })

    # Periodic/triggered refreshes reset the browsable preview back to the
    # real current week -- same behavior the old glance-meals timer had.
    _recompute_preview(actual_week)
    state.set("input_number.khione_meals_preview_week", actual_week)


def _recompute_preview(preview_week):
    recipes = load_recipes()
    recipes_by_id = {r["id"]: r for r in recipes}
    plan = load_plan()
    today = date.today()
    actual_week = week_for(today, plan)
    today_day_idx = today.weekday()
    data = week_view(preview_week, actual_week, today_day_idx, plan, recipes_by_id)
    state.set("sensor.khione_meals_preview", preview_week, new_attributes=data)


def _recompute_weight():
    entries = load_json(WEIGHT_LOG_PATH, [])
    profile = load_profile()
    state.set("sensor.khione_weight", "ok", new_attributes=weight_view(entries, profile))


@time_trigger("cron(0 0 * * *)")
def khione_meals_midnight_refresh():
    _recompute_today()


@service
def khione_meals_log_weight(kg=None):
    # Direct parameter from the Meals panel's hass.callService call.
    try:
        kg = round(float(kg), 1)
        if not 30 <= kg <= 300:
            raise ValueError
    except (TypeError, ValueError):
        log.error("khione_meals_log_weight: bad kg value %r", kg)
        return
    today_iso = date.today().isoformat()
    entries = [e for e in load_json(WEIGHT_LOG_PATH, []) if e["date"] != today_iso]
    entries.append({"date": today_iso, "kg": kg})
    write_json(WEIGHT_LOG_PATH, sorted(entries, key=lambda e: e["date"]))
    _recompute_weight()


@service
def khione_meals_save_profile(age=None, height_cm=None, sex=None, activity=None):
    try:
        profile = {
            "age": int(float(age)),
            "height_cm": int(float(height_cm)),
            "sex": sex,
            "activity": float(activity),
        }
        if not (10 <= profile["age"] <= 120 and 100 <= profile["height_cm"] <= 250
                and profile["sex"] in ("male", "female")
                and str(activity) in ACTIVITY_FACTORS):
            raise ValueError
    except (TypeError, ValueError):
        log.error("khione_meals_save_profile: bad profile values")
        return
    write_json(WEIGHT_PROFILE_PATH, profile)
    _recompute_weight()


@service
def khione_meals_save_recipe(id=None, name=None, meal_type=None, kcal_min=None,
                              kcal_max=None, protein_min=None, protein_max=None,
                              ingredients=None, instructions=None, batch=None,
                              fresh=None):
    try:
        rid = (id or "").strip()
        name = (name or "").strip()[:200]
        kcal_min = int(float(kcal_min))
        kcal_max = int(float(kcal_max))
        protein_min = int(float(protein_min))
        protein_max = int(float(protein_max))
        batch = int(float(batch))
        fresh = bool(fresh)
        # cap length for sanity/storage, same limit the old input_text helpers had.
        ingredients = (ingredients or "").strip()[:255]
        instructions = (instructions or "").strip()[:255]
        if not (name and meal_type in MEAL_TYPES
                and 0 <= kcal_min <= kcal_max <= 3000
                and 0 <= protein_min <= protein_max <= 300
                and 0 <= batch <= 20):
            raise ValueError
    except (TypeError, ValueError):
        log.error("khione_meals_save_recipe: bad recipe values")
        return
    recipes = load_recipes()
    ids = {r["id"] for r in recipes}
    recipes_by_id = {r["id"]: r for r in recipes}
    existing = recipes_by_id.get(rid) if rid and rid in ids else None
    if existing is not None:
        recipe = existing
        # Editing: a real form might still legitimately submit a blank
        # ingredients/instructions field -- keep the old value rather than
        # wiping it.
        if not ingredients:
            ingredients = recipe.get("ingredients", "")
        if not instructions:
            instructions = recipe.get("instructions", "")
    else:
        rid = unique_id(slugify(name), ids)
        recipe = {"id": rid}
        recipes.append(recipe)
    recipe.update({
        "name": name, "meal_type": meal_type,
        "kcal_min": kcal_min, "kcal_max": kcal_max,
        "protein_min": protein_min, "protein_max": protein_max,
        "ingredients": ingredients, "instructions": instructions,
        "batch": batch, "fresh": fresh,
    })
    write_json(RECIPES_PATH, {"recipes": recipes})
    _recompute_today()


@service
def khione_meals_delete_recipe(id=None):
    rid = (id or "").strip()
    if not rid:
        log.error("khione_meals_delete_recipe: missing id")
        return
    plan = load_plan()
    if recipe_in_use(rid, plan):
        log.error(f"khione_meals_delete_recipe: {rid} is still used in the plan")
        return
    recipes = [r for r in load_recipes() if r["id"] != rid]
    write_json(RECIPES_PATH, {"recipes": recipes})
    _recompute_today()


@service
def khione_meals_set_preview_week(week=None):
    try:
        total_weeks = len(load_plan()["weeks"])
        week = ((int(week) - 1) % total_weeks) + 1
    except (TypeError, ValueError):
        log.error(f"khione_meals_set_preview_week: bad week value {week!r}")
        return
    state.set("input_number.khione_meals_preview_week", week)
    _recompute_preview(week)


@service
def khione_meals_preview_next():
    plan = load_plan()
    total_weeks = len(plan["weeks"])
    current = int(float(state.get("input_number.khione_meals_preview_week") or week_for(date.today(), plan)))
    khione_meals_set_preview_week(week=current % total_weeks + 1)


@service
def khione_meals_preview_prev():
    plan = load_plan()
    total_weeks = len(plan["weeks"])
    current = int(float(state.get("input_number.khione_meals_preview_week") or week_for(date.today(), plan)))
    khione_meals_set_preview_week(week=(current - 2) % total_weeks + 1)


@service
def khione_meals_preview_today():
    khione_meals_set_preview_week(week=week_for(date.today(), load_plan()))


# Run once at (re)load so the sensors exist immediately, not just after the
# next midnight cron tick.
_recompute_today()
_recompute_weight()
