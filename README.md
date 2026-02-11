# Desktop Wayland KDE Arch Setup

This is my pre-configured Arch Linux rice. It is NOT a featherweight setup, and comes with all the programs I use regularly on my desktop within reason. It follows the Cattpucin Mocha colour scheme where possible.

<p align="center">
  <img width="3440" height="1440" alt="Screenshot_20260112_200906" src="https://github.com/user-attachments/assets/fc60e021-2757-4e13-b82b-13bc5e129cdf" />
</p>

<br>

<p align="center">
  <img width="3440" height="1440" alt="Screenshot_20260112_201312" src="https://github.com/user-attachments/assets/ab8e810a-85cd-45aa-aaff-24e6f034ba0d" />
</p>

---

## To Investigate

- Installing FL studio by script, seeing as it can only be run with wine.
- The above for VOCALOID 6 as well, which is unstable.

---

# Usage

It's not a perfect just run and go, you need to do a few bits and bobs first.

## Step 1: Get a super basic arch install

I really do mean the absolute minimum. Grab an Arch ISO, stick it on a USB stick, boot into arch, and use the archinstaller. I've installed Arch enough times to know I really don't need to do all that manually. If you never have, it's worth trying at least once. Follow this, you will need the first couple steps to get an internet connection -> https://wiki.archlinux.org/title/Installation_guide

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

## Step 5: Make the script executable

Make the script executable with the following command:

```
sudo chmod +x Arch-Linux-Setups/desktop-install/setupDesktop.sh
```
OR
```
sudo chmod +x Arch-Linux-Setups/server-install/setupServer.sh
```

## Step 6: Run the script

You can run shell scripts with the following command. Follow through the script and insert the correct information when prompted. This will take a while and will ask for superuser access a few times. To be fair, it is setting up your whole desktop!

```
./Arch-Linux-Setups/desktop-install/setupDesktop.sh
```
OR
```
./Arch-Linux-Setups/server-install/setupServer.sh
```

## Step 7: Reboot

Once the script is done, reboot your PC

## Step 8: Final setup

Log in using the username and password you setup during archinstall (It will remember your username for future logins) and set the wallpaper, it should be stored at the bottom of the wallpapers setting in KDE. It sucks but I cannot figure out a way to set it by script, looks like a plasma session needs to be running.

---

There we have it! Enjoy a fully featured, stable, and intuitive arch installation.

---

# FAQ

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
