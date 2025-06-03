#include "hotkey_windows.h"
#include <windows.h>

// 上次检测到热键按下的时间
static DWORD lastHotkeyTime = 0;
// 防抖间隔（毫秒）
static const DWORD DEBOUNCE_INTERVAL = 300;

// 检查指定虚拟键码是否被按下
// vkCode: Windows 虚拟键码
// 返回值: 1-按下状态, 0-未按下状态
int isKeyPressed(int vkCode) {
    SHORT keyState = GetAsyncKeyState(vkCode);
    // 检查最高位是否为1（表示按下状态）
    return (keyState & 0x8000) ? 1 : 0;
}

// 检查热键组合是否被按下
// ctrl, shift, alt, win: 修饰键状态 (1-需要按下, 0-不需要按下)
// mainKey: 主键的虚拟键码
// 返回值: 1-热键组合被按下, 0-未按下
int isHotkeyPressed(int ctrl, int shift, int alt, int win, int mainKey) {
    // 获取当前时间
    DWORD currentTime = GetTickCount();
    
    // 防抖检查：如果距离上次触发时间太短，直接返回0
    if (currentTime - lastHotkeyTime < DEBOUNCE_INTERVAL) {
        return 0;
    }
    
    // 检查修饰键状态
    int ctrlPressed = isKeyPressed(VK_CONTROL) || isKeyPressed(VK_LCONTROL) || isKeyPressed(VK_RCONTROL);
    int shiftPressed = isKeyPressed(VK_SHIFT) || isKeyPressed(VK_LSHIFT) || isKeyPressed(VK_RSHIFT);
    int altPressed = isKeyPressed(VK_MENU) || isKeyPressed(VK_LMENU) || isKeyPressed(VK_RMENU);
    int winPressed = isKeyPressed(VK_LWIN) || isKeyPressed(VK_RWIN);
    
    // 检查主键状态
    int mainKeyPressed = isKeyPressed(mainKey);
    
    // 所有条件都必须匹配
    if (ctrl && !ctrlPressed) return 0;
    if (!ctrl && ctrlPressed) return 0;
    
    if (shift && !shiftPressed) return 0;
    if (!shift && shiftPressed) return 0;
    
    if (alt && !altPressed) return 0;
    if (!alt && altPressed) return 0;
    
    if (win && !winPressed) return 0;
    if (!win && winPressed) return 0;
    
    if (!mainKeyPressed) return 0;
    
    // 所有条件匹配，更新最后触发时间
    lastHotkeyTime = currentTime;
    return 1;
} 