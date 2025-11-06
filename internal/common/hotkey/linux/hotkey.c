//go:build linux

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>

extern void hotkeyDown(uintptr_t hkhandle);
extern void hotkeyUp(uintptr_t hkhandle);

// Global error flag for BadAccess detection
static int grab_error_occurred = 0;

// Error handler for X11 errors
static int handleXError(Display* dpy, XErrorEvent* pErr) {
	// Check if it's a GrabKey error (request_code == 33)
	if (pErr->request_code == 33) {
		// BadAccess means the key is already grabbed by another client
		if (pErr->error_code == BadAccess) {
			grab_error_occurred = 1;
			return 0;
		}
	}
	// For other errors, use default handler
	return 0;
}

// displayTest checks if X11 display is available
int displayTest() {
	Display* d = NULL;
	for (int i = 0; i < 42; i++) {
		d = XOpenDisplay(0);
		if (d == NULL) continue;
		XCloseDisplay(d);
		return 0;
	}
	return -1;
}

// DisplayContext represents a persistent X11 display connection
typedef struct {
	Display* display;
	int keycode;
	unsigned int mod;
	Window root;
} DisplayContext;

// openDisplay opens and initializes a display context
// Returns NULL on failure
DisplayContext* openDisplay(unsigned int mod, int key) {
	Display* d = NULL;
	for (int i = 0; i < 42; i++) {
		d = XOpenDisplay(0);
		if (d != NULL) break;
	}
	if (d == NULL) {
		return NULL;
	}

	DisplayContext* ctx = (DisplayContext*)malloc(sizeof(DisplayContext));
	if (ctx == NULL) {
		XCloseDisplay(d);
		return NULL;
	}

	ctx->display = d;
	ctx->keycode = XKeysymToKeycode(d, key);
	ctx->mod = mod;
	ctx->root = DefaultRootWindow(d);

	return ctx;
}

// closeDisplay closes the display and frees the context
void closeDisplay(DisplayContext* ctx) {
	if (ctx == NULL) return;
	if (ctx->display != NULL) {
		XCloseDisplay(ctx->display);
	}
	free(ctx);
}

// grabHotkey attempts to grab the hotkey with error handling
// Returns: 0 on success, -1 on BadAccess (conflict), -2 on other errors
int grabHotkey(DisplayContext* ctx) {
	if (ctx == NULL || ctx->display == NULL) {
		return -2;
	}

	// Set custom error handler
	grab_error_occurred = 0;
	XErrorHandler old_handler = XSetErrorHandler(handleXError);

	// Attempt to grab the key
	XGrabKey(ctx->display, ctx->keycode, ctx->mod, ctx->root, 
	         False, GrabModeAsync, GrabModeAsync);

	// Flush to ensure the grab request is processed
	XSync(ctx->display, False);

	// Restore old error handler
	XSetErrorHandler(old_handler);

	// Check if error occurred
	if (grab_error_occurred) {
		return -1; // BadAccess - hotkey conflict
	}

	// Select input for both KeyPress and KeyRelease
	XSelectInput(ctx->display, ctx->root, KeyPressMask | KeyReleaseMask);

	return 0;
}

// ungrabHotkey releases the grabbed hotkey
void ungrabHotkey(DisplayContext* ctx) {
	if (ctx == NULL || ctx->display == NULL) return;
	XUngrabKey(ctx->display, ctx->keycode, ctx->mod, ctx->root);
	XFlush(ctx->display);
}

// registerHotkey attempts to register the hotkey and returns a display context
// Returns: context pointer on success, NULL on failure
// Sets *error_code: 0 = success, -1 = BadAccess (conflict), -2 = other error
DisplayContext* registerHotkey(unsigned int mod, int key, int* error_code) {
	DisplayContext* ctx = openDisplay(mod, key);
	if (ctx == NULL) {
		*error_code = -2;
		return NULL;
	}

	int grab_result = grabHotkey(ctx);
	if (grab_result != 0) {
		*error_code = grab_result;
		closeDisplay(ctx);
		return NULL;
	}

	*error_code = 0;
	return ctx;
}

// unregisterHotkey ungrab the hotkey and closes the display
void unregisterHotkey(DisplayContext* ctx) {
	if (ctx == NULL) return;
	ungrabHotkey(ctx);
	closeDisplay(ctx);
}

// waitHotkeyEvent waits for the next hotkey event on an already-registered hotkey
// Returns: 1 for KeyPress, 2 for KeyRelease, 0 for other events, -1 on error
int waitHotkeyEvent(DisplayContext* ctx, uintptr_t hkhandle) {
	if (ctx == NULL || ctx->display == NULL) {
		return -1;
	}

	XEvent ev;
	XNextEvent(ctx->display, &ev);
	
	switch(ev.type) {
	case KeyPress:
		hotkeyDown(hkhandle);
		return 1;
	case KeyRelease:
		hotkeyUp(hkhandle);
		return 2;
	default:
		return 0;
	}
}

// Legacy waitHotkey for compatibility - now uses the new API internally
// Returns: 0 on KeyRelease, -1 on BadAccess (conflict), -2 on other error
int waitHotkey(uintptr_t hkhandle, unsigned int mod, int key) {
	int error_code = 0;
	DisplayContext* ctx = registerHotkey(mod, key, &error_code);
	if (ctx == NULL) {
		return error_code;
	}

	// Event loop
	while(1) {
		int result = waitHotkeyEvent(ctx, hkhandle);
		if (result == 2) { // KeyRelease
			unregisterHotkey(ctx);
			return 0;
		}
		if (result < 0) { // Error
			unregisterHotkey(ctx);
			return -2;
		}
	}
}