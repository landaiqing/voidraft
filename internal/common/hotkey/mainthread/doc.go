// Copyright 2022 The golang.design Initiative Authors.
// All rights reserved. Use of this source code is governed
// by a MIT license that can be found in the LICENSE file.
//
// Written by Changkun Ou <changkun.de>

// Package mainthread provides facilities to schedule functions
// on the main thread. It includes platform-specific implementations
// for Windows, Linux, and macOS. The macOS implementation is specially
// designed to handle main thread events for the NSApplication.
package mainthread
