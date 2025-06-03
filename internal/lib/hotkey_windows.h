#ifndef HOTKEY_WINDOWS_H
#define HOTKEY_WINDOWS_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// 检查指定虚拟键码是否被按下
// vkCode: Windows 虚拟键码
// 返回值: 1-按下状态, 0-未按下状态
int isKeyPressed(int vkCode);

// 检查热键组合是否被按下
// ctrl, shift, alt, win: 修饰键状态 (1-需要按下, 0-不需要按下)
// mainKey: 主键的虚拟键码
// 返回值: 1-热键组合被按下, 0-未按下
int isHotkeyPressed(int ctrl, int shift, int alt, int win, int mainKey);

#ifdef __cplusplus
}
#endif

#endif // HOTKEY_WINDOWS_H 