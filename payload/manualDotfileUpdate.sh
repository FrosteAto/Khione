mkdir -p ~/arch-dotfiles/{config,local/share}

for app in \
  kitty btop nano mpv easyeffects audacity obs-studio \
  kdenlive krita blender godot gamescope lsp-plugins
do
  cp -r ~/.config/$app ~/arch-dotfiles/config/ 2>/dev/null || true
done

cp -r ~/.local/share/krita ~/arch-dotfiles/local/share/ 2>/dev/null || true
