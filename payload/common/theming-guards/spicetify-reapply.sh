#!/bin/bash
set -e
runuser -u @@ARCH_USER@@ -- spicetify restore backup apply
