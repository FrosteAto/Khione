# fix for screen readers
if grep -Fqa 'accessibility=' /proc/cmdline &> /dev/null; then
    setopt SINGLE_LINE_ZLE
fi

~/.automated_script.sh

if [[ $(tty) == "/dev/tty1" ]] && ! grep -Fqa 'script=' /proc/cmdline && [[ -x /root/start-install-server.sh ]]; then
    /root/start-install-server.sh
fi
