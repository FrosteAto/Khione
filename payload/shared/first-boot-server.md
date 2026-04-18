# Welcome to FrosteArch Server

Setup has finished and services are configured.

## Recommended checks

- Verify key services:

```bash
systemctl status plexmediaserver
systemctl status ufw
```

- Review installation logs if needed:

```bash
ls -1 /var/log/frostearch/
cat /var/log/archinstall/install.log
```

You're good to go.
