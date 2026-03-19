# FrosteArch

Welcome to FrosteArch, an opinionated Arch distro with ease of use in mind. It's the kind of distro that you don't need to revise to use, but will still benefit from all the positives of a bleeding edge setup with deep configuration options.

There's two main version:

- Desktop Edition
- Server Edition

The desktop edition comes with all the programs I expect to use on a daily basis and once in a while, everything from browsers to game launchers to photo editing software. It's super fully featured. 

The server edition is a super slimmed down version that also pre-configured Plex to be running at all times and with the correct ports open, but still has the minimum for on-device debugging available to you.

---

# Desktop

<p align="center">
  <img width="3440" height="1440" alt="Screenshot_20260112_200906" src="./payload/images/Desktop1.png" />
</p>

<br>

<p align="center">
  <img width="3440" height="1440" alt="Screenshot_20260112_201312" src="./payload/images/Desktop2.png" />
</p>

---

# Server

<p align="center">
  <img width="1920" height="1200" alt="Screenshot_20260212_192443" src="./payload/images/Server1.png" />
</p>

<br>

<p align="center">
  <img width="1920" height="1200" alt="Screenshot_20260212_192431" src="./payload/images/Server2.png" />
</p>

---

## To Investigate / Do

- Include konsave config file in dotfile backups
- Move images into repo
- Update desktop images
- Update desktop konsave / dotfiles
- Plasma update broke pager widget
- Installing FL studio by script, seeing as it can only be run with wine.
- The above for VOCALOID 6 as well, which is unstable.

---

# Usage

It's not a perfect just run and go, you need to do a few bits and bobs first.

## Step 1: Download the ISO

Download the Desktop or Server ISO from the releases section

## Step 2: Install the ISO to a USB

Using a utility USBImager, Balena Etcher, or Rufus, install the ISO to the USB.

## Step 3: Boot the USB

Plug the USB into the PC and boot into it, select the install Arch option

## Step 4: Run the script

Complete the basic ArchInstall configuration - select your mirror regions, add users / passwords, and set up disk partitions


## Step 5: Let it run

Allow Archinstall to install Arch. Once it's done, it will install all the other packages and set up the environment

## Step 6: Reboot

Once the script is done, reboot your PC and log in.

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
