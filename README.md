# FrosteAto's Arch Install Scripts

Hia!!

This is my big ol' script for installing Arch. I use Arch as the sole OS for all my computers including servers, so having these ready to go, modular, and easy to use makes my life 50x easier. You can use them too!

There's two main version:

- Desktop Edition
- Server Edition

The desktop edition comes with all the programs I expect to use on a daily basis and once in a while, everything from browsers to game launchers to photo editing software. It's super fully featured. 

The server edition is a super slimmed down version that also pre-configured Plex to be running at all times and with the correct ports open, but still has the minimum for on-device debugging available to you.

---

# Desktop

<p align="center">
  <img width="3440" height="1440" alt="Screenshot_20260112_200906" src="https://github.com/user-attachments/assets/fc60e021-2757-4e13-b82b-13bc5e129cdf" />
</p>

<br>

<p align="center">
  <img width="3440" height="1440" alt="Screenshot_20260112_201312" src="https://github.com/user-attachments/assets/ab8e810a-85cd-45aa-aaff-24e6f034ba0d" />
</p>

---

# Server

<p align="center">
  <img width="1920" height="1200" alt="Screenshot_20260212_192443" src="https://github.com/user-attachments/assets/e45968f9-9a16-43d2-a01f-a5e19bfc20ce" />
</p>

<br>

<p align="center">
  <img width="1920" height="1200" alt="Screenshot_20260212_192431" src="https://github.com/user-attachments/assets/47e4210e-70f8-428a-aaba-5c6cdefd6b92" />
</p>

---

## To Investigate

- Installing FL studio by script, seeing as it can only be run with wine.
- The above for VOCALOID 6 as well, which is unstable.

---

# Usage

It's not a perfect just run and go, you need to do a few bits and bobs first.

## Step 1: Get a super basic arch install

I really do mean the absolute minimum. Grab an Arch ISO, stick it on a USB stick, boot into Arch, and use the archinstaller. I've installed Arch enough times to know I really don't need to do all that manually. If you never have, it's worth trying at least once. Follow this, you will need the first couple steps to get an internet connection -> https://wiki.archlinux.org/title/Installation_guide

In the archinstaller, pick the 'minimal' preset. Do whatever other settings you want, but be sure to set up at least one user and use NetworkManager for your internet connection.

## Step 2: Boot into Arch and get connected (again)

Once the basic arch install is done, boot into it and get an internet connection. This time, setting up your connection will be via the NetworkManager CLI though. Peep the basics here -> https://wiki.archlinux.org/title/NetworkManager

## Step 3: Install git

```
sudo pacman -S git
```

## Step 4: Clone the repo
You can now use git to clone the installation repo. You will need to know the exact URL. Here's one I prepared earlier:

```
git clone https://github.com/FrosteAto/Arch-Linux-Setups.git
```

## Step 5: Run the script

You can run shell scripts with the following command. Follow through the script and insert the correct information when prompted. This will take a while and will ask for superuser access a few times. To be fair, it is setting up your whole desktop!

```
./Arch-Linux-Setups/install.sh
```
Follow its instructions.


## Step 6: Reboot

Once the script is done, reboot your PC.

---

There we have it! Enjoy a fully featured, stable, and intuitive Arch installation.

---

# FAQ

## Why not use a headless server?

- No modern hardware has a meaningful loss from having something like plasma running in the background
  - Miku :)
- Sometimes it's easier to debug on-device and this is running on a spare laptop
  - Miku :D
- I can still SSH in
  - Miku :3
- I wanted an excuse to rice Arch again
  - Miku :0
- I have a staggering skill issue

## How do I use my programs?

Pressing alt + space will open KRunner, which you can use to type in any program name or category and it will appear.

## How do I update my programs?

Just type yay into the terminal, it will find and update everything for you. Very handy.

## How do I get new programs?

Google "*program you need or problem to solve* Arch" and and it will probably appear. If it's part of the main Arch repos you can do 

```
sudo pacman -S *packageName*
```
and if it's part of the AUR you can do
```
yay -S *packageName*
```
to install it.
