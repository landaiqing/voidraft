//go:build darwin

#include <stdint.h>
#import <Cocoa/Cocoa.h>

extern void dispatchMainFuncs();

void wakeupMainThread(void) {
	dispatch_async(dispatch_get_main_queue(), ^{
		dispatchMainFuncs();
	});
}

// The following three lines of code must run on the main thread.
// For GUI applications (Wails, Cocoa), the framework handles this automatically.
// For CLI applications, see README for manual event loop setup.
//
// Inspired from: https://github.com/cehoffman/dotfiles/blob/4be8e893517e970d40746a9bdc67fe5832dd1c33/os/mac/iTerm2HotKey.m
void os_main(void) {
	[NSApplication sharedApplication];
	[NSApp disableRelaunchOnLogin];
	[NSApp run];
}