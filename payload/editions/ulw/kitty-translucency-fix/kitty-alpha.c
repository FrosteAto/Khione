/*
 * kitty-alpha: make kitty's background_opacity work on this VirtualBox VM.
 *
 * Xorg's GLX here (llvmpipe, no glamor) advertises GLX_*_framebuffer_sRGB but
 * exposes zero sRGB-capable FBConfigs. kitty requests sRGB on X11 and its GLFW
 * chooser demands "transparent AND sRGB", so nothing matches and it falls back
 * to the first (24-bit, alpha-less) config. Hiding the unusable sRGB extension
 * lets it pick a 32-bit ARGB visual that picom can blend.
 *
 * Build: gcc -shared -fPIC -O2 -o kitty-alpha.so kitty-alpha.c -ldl
 * Use:   LD_PRELOAD=~/.local/lib/kitty-alpha/kitty-alpha.so kitty
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
#include <string.h>

typedef const char *(*qes_fn)(void *, int);
typedef void *(*dlsym_fn)(void *, const char *);

static qes_fn real_qes;
static dlsym_fn real_dlsym;
static char filtered[16384];

__attribute__((constructor)) static void init(void) {
    real_dlsym = (dlsym_fn)dlvsym(RTLD_NEXT, "dlsym", "GLIBC_2.34");
    if (!real_dlsym) real_dlsym = (dlsym_fn)dlvsym(RTLD_NEXT, "dlsym", "GLIBC_2.2.5");
    /* Don't leak into shells/programs started from kitty. */
    unsetenv("LD_PRELOAD");
}

static const char *filtered_qes(void *dpy, int screen) {
    const char *orig = real_qes(dpy, screen);
    if (!orig) return orig;
    char buf[sizeof filtered];
    strncpy(buf, orig, sizeof buf - 1);
    buf[sizeof buf - 1] = 0;
    filtered[0] = 0;
    for (char *save, *tok = strtok_r(buf, " ", &save); tok; tok = strtok_r(NULL, " ", &save)) {
        if (strstr(tok, "framebuffer_sRGB")) continue;
        strncat(filtered, tok, sizeof filtered - strlen(filtered) - 2);
        strcat(filtered, " ");
    }
    return filtered;
}

void *dlsym(void *handle, const char *name) {
    if (!real_dlsym) init();
    void *p = real_dlsym(handle, name);
    if (p && name && strcmp(name, "glXQueryExtensionsString") == 0) {
        real_qes = (qes_fn)p;
        return (void *)filtered_qes;
    }
    return p;
}
