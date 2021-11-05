#pragma once

#include <curses.h>

#define IS_KEY_Q(c) ((c) == (0x51 | 0x71))
#define IS_KEY_W(c) ((c) == (0x57 | 0x77))
#define IS_KEY_A(c) ((c) == (0x41 | 0x61))
#define IS_KEY_S(c) ((c) == (0x53 | 0x73))
#define IS_KEY_D(c) ((c) == (0x44 | 0x64))
#define IS_KEY_P(c) ((c) == (0x50 | 0x70))
#define IS_KEY_E(c) ((c) == (0x45 | 0x65))
#define IS_KEY_T(c) ((c) == (0x54 | 0x74))
#define IS_KEY_C(c) ((c) == (0x43 | 0x63))

#define UI_COLOR_RED        (1)
#define UI_COLOR_YELLOW     (2)
#define UI_COLOR_GREEN      (3)
#define UI_COLOR_BLUE       (4)

#define M_VALUE(a, fmt, ...) \
    do { \
        attrset(A_BOLD); \
        printw(a); \
        attrset(A_NORMAL); \
        printw(fmt __VA_OPT__(,) __VA_ARGS__); \
        clrtoeol(); \
    } while (false)

#define M_SELECT(q, ...) \
    do { \
        attrset(COLOR_PAIR(UI_COLOR_INV_GREEN)); \
        printw(q __VA_OPT__(,) __VA_ARGS__); \
        attrset(A_NORMAL); \
    } while (false)

#define M_ERROR(q, ...) \
    do { \
        attrset(COLOR_PAIR(UI_COLOR_RED)); \
        printw(q __VA_OPT__(,) __VA_ARGS__); \
        attrset(A_NORMAL); \
    } while (false)

#define M_EMPH(q, ...) \
    do { \
        attrset(COLOR_PAIR(UI_COLOR_EMPH) | A_BOLD); \
        printw(q __VA_OPT__(,) __VA_ARGS__); \
        attrset(A_NORMAL); \
    } while (false)

#define M_SHORTCUT(a, b) \
    do { \
        attrset(COLOR_PAIR(UI_COLOR_RED)); \
        printw(a); \
        attrset(A_NORMAL); \
        printw(b); \
    } while(false)

#define M_BOLD(a, ...) \
    do { \
        attrset(A_BOLD); \
        printw(a __VA_OPT__(,) __VA_ARGS__); \
        attrset(A_NORMAL); \
    } while(false)

#define SET_LINE(x) move((x), 1)
#define TEMP_COLOR(v, rng) attrset((v) < rng.r1 ? COLOR_PAIR(UI_COLOR_BLUE) : (v) < rng.r2 ? COLOR_PAIR(UI_COLOR_GREEN) : COLOR_PAIR(UI_COLOR_RED))
