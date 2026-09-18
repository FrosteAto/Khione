mkdir -p ~/arch-dotfiles/{config,local/share}

for app in \
  kitty btop nano mpv easyeffects audacity obs-studio \
  kdenlive krita blender godot gamescope lsp-plugins konsave fastfetch
do
  cp -r ~/.config/$app ~/arch-dotfiles/config/ 2>/dev/null || true
done

cp -r ~/.local/share/krita ~/arch-dotfiles/local/share/ 2>/dev/null || true

# Strip cache/log/session churn that cp -r sweeps in but shouldn't be tracked
rm -rf ~/arch-dotfiles/config/obs-studio/logs \
       ~/arch-dotfiles/config/obs-studio/profiler_data \
       ~/arch-dotfiles/config/obs-studio/plugins \
       ~/arch-dotfiles/config/konsave/profiles
rm -f ~/arch-dotfiles/local/share/krita/resourcecache.sqlite*
