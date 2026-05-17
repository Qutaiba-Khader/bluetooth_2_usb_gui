const USAGES = {
  source: {
    "Keyboard": {
      "KEY_A": 30, "KEY_B": 48, "KEY_C": 46, "KEY_D": 32, "KEY_E": 18,
      "KEY_F": 33, "KEY_G": 34, "KEY_H": 35, "KEY_I": 23, "KEY_J": 36,
      "KEY_K": 37, "KEY_L": 38, "KEY_M": 50, "KEY_N": 49, "KEY_O": 24,
      "KEY_P": 25, "KEY_Q": 16, "KEY_R": 19, "KEY_S": 31, "KEY_T": 20,
      "KEY_U": 22, "KEY_V": 47, "KEY_W": 17, "KEY_X": 45, "KEY_Y": 21,
      "KEY_Z": 44, "KEY_1": 2, "KEY_2": 3, "KEY_3": 4, "KEY_4": 5,
      "KEY_5": 6, "KEY_6": 7, "KEY_7": 8, "KEY_8": 9, "KEY_9": 10,
      "KEY_0": 11, "KEY_ENTER": 28, "KEY_ESC": 1, "KEY_BACKSPACE": 14,
      "KEY_TAB": 15, "KEY_SPACE": 57, "KEY_MINUS": 12, "KEY_EQUAL": 13,
      "KEY_LEFTBRACE": 26, "KEY_RIGHTBRACE": 27, "KEY_BACKSLASH": 43,
      "KEY_SEMICOLON": 39, "KEY_APOSTROPHE": 40, "KEY_GRAVE": 41,
      "KEY_COMMA": 51, "KEY_DOT": 52, "KEY_SLASH": 53,
      "KEY_CAPSLOCK": 58,
      "KEY_F1": 59, "KEY_F2": 60, "KEY_F3": 61, "KEY_F4": 62,
      "KEY_F5": 63, "KEY_F6": 64, "KEY_F7": 65, "KEY_F8": 66,
      "KEY_F9": 67, "KEY_F10": 68, "KEY_F11": 87, "KEY_F12": 88,
      "KEY_F13": 183, "KEY_F14": 184, "KEY_F15": 185, "KEY_F16": 186,
      "KEY_F17": 187, "KEY_F18": 188, "KEY_F19": 189, "KEY_F20": 190,
      "KEY_F21": 191, "KEY_F22": 192, "KEY_F23": 193, "KEY_F24": 194,
      "KEY_INSERT": 110, "KEY_HOME": 102, "KEY_PAGEUP": 104,
      "KEY_DELETE": 111, "KEY_END": 107, "KEY_PAGEDOWN": 109,
      "KEY_RIGHT": 106, "KEY_LEFT": 105, "KEY_DOWN": 108, "KEY_UP": 103,
      "KEY_NUMLOCK": 69, "KEY_SYSRQ": 99, "KEY_SCROLLLOCK": 70,
      "KEY_PAUSE": 119, "KEY_102ND": 86,
      "KEY_LEFTCTRL": 29, "KEY_LEFTSHIFT": 42,
      "KEY_LEFTALT": 56, "KEY_LEFTMETA": 125, "KEY_RIGHTCTRL": 97,
      "KEY_RIGHTSHIFT": 54, "KEY_RIGHTALT": 100, "KEY_RIGHTMETA": 126,
      "KEY_COMPOSE": 127,
      "KEY_RO": 89, "KEY_KATAKANAHIRAGANA": 93,
      "KEY_YEN": 124, "KEY_HENKAN": 92, "KEY_MUHENKAN": 94,
      "KEY_HANGEUL": 122
    },
    "Numpad": {
      "KEY_KPSLASH": 98, "KEY_KPASTERISK": 55, "KEY_KPMINUS": 74,
      "KEY_KPPLUS": 78, "KEY_KPENTER": 96, "KEY_KPDOT": 83,
      "KEY_KP0": 82, "KEY_KP1": 79, "KEY_KP2": 80, "KEY_KP3": 81,
      "KEY_KP4": 75, "KEY_KP5": 76, "KEY_KP6": 77,
      "KEY_KP7": 71, "KEY_KP8": 72, "KEY_KP9": 73,
      "KEY_KPEQUAL": 117, "KEY_KPCOMMA": 121
    },
    "Media / Consumer": {
      "KEY_MUTE": 113, "KEY_VOLUMEUP": 115, "KEY_VOLUMEDOWN": 114,
      "KEY_PLAYPAUSE": 164, "KEY_PLAY": 207, "KEY_STOPCD": 166,
      "KEY_NEXTSONG": 163, "KEY_PREVIOUSSONG": 165,
      "KEY_FASTFORWARD": 208, "KEY_REWIND": 168,
      "KEY_RECORD": 167, "KEY_EJECTCD": 161,
      "KEY_SHUFFLE": 176, "KEY_SLOW": 215,
      "KEY_FRAMEFORWARD": 216, "KEY_FRAMEBACK": 217,
      "KEY_CHANNELUP": 402, "KEY_CHANNELDOWN": 403,
      "KEY_RED": 398, "KEY_GREEN": 399, "KEY_BLUE": 401, "KEY_YELLOW": 400,
      "KEY_INFO": 358, "KEY_SUBTITLE": 370,
      "KEY_ASPECTRATIO": 374, "KEY_AUDIO": 392,
      "KEY_LAST": 404, "KEY_DVR": 393,
      "KEY_PROGRAM": 362, "KEY_MEDIA_REPEAT": 184,
      "KEY_BRIGHTNESSUP": 225, "KEY_BRIGHTNESSDOWN": 224
    },
    "Android TV Remote": {
      "KEY_POWER": 116, "KEY_SLEEP": 142, "KEY_WAKEUP": 143,
      "KEY_MENU": 139, "KEY_SELECT": 353, "KEY_BACK": 158,
      "KEY_FORWARD": 159, "KEY_HOMEPAGE": 172, "KEY_SEARCH": 217,
      "KEY_EXIT": 174, "KEY_HELP": 138,
      "KEY_VOICECOMMAND": 582, "KEY_ASSISTANT": 583,
      "KEY_DICTATE": 583, "KEY_EMOJI_PICKER": 584,
      "KEY_APPSELECT": 580, "KEY_FULL_SCREEN": 431,
      "KEY_TV": 377, "KEY_TV2": 394, "KEY_DVD": 389,
      "KEY_GAMES": 422, "KEY_TUNER": 386, "KEY_SAT": 381,
      "KEY_PVR": 393, "KEY_CONFIG": 171,
      "KEY_RESTART": 408, "KEY_PHONE": 169
    },
    "Apps & Browser": {
      "KEY_WWW": 150, "KEY_MAIL": 155, "KEY_CALC": 140,
      "KEY_FILE": 144, "KEY_BOOKMARKS": 156,
      "KEY_PLAYER": 209, "KEY_CHAT": 216, "KEY_COFFEE": 152,
      "KEY_CALENDAR": 397, "KEY_CAMERA": 212,
      "KEY_KBDILLUMUP": 229, "KEY_KBDILLUMDOWN": 230,
      "KEY_KBDILLUMTOGGLE": 228,
      "KEY_PC": 376, "KEY_CD": 383, "KEY_VCR": 378,
      "KEY_VIDEO_NEXT": 241,
      "KEY_WORDPROCESSOR": 421, "KEY_SPREADSHEET": 423,
      "KEY_GRAPHICSEDITOR": 424,
      "KEY_REFRESH": 173, "KEY_SCROLLUP": 177, "KEY_SCROLLDOWN": 178,
      "KEY_ZOOMIN": 418, "KEY_ZOOMOUT": 419,
      "KEY_STOP_BROWSER": 128
    },
    "Mouse": {
      "BTN_LEFT": 272, "BTN_RIGHT": 273, "BTN_MIDDLE": 274,
      "BTN_SIDE": 275, "BTN_EXTRA": 276, "BTN_FORWARD": 277,
      "BTN_BACK": 278, "BTN_TASK": 279, "BTN_MISC": 256
    }
  },
  target: {
    "Keyboard": {
      "A": 4, "B": 5, "C": 6, "D": 7, "E": 8, "F": 9, "G": 10, "H": 11,
      "I": 12, "J": 13, "K": 14, "L": 15, "M": 16, "N": 17, "O": 18,
      "P": 19, "Q": 20, "R": 21, "S": 22, "T": 23, "U": 24, "V": 25,
      "W": 26, "X": 27, "Y": 28, "Z": 29,
      "ONE": 30, "TWO": 31, "THREE": 32, "FOUR": 33, "FIVE": 34,
      "SIX": 35, "SEVEN": 36, "EIGHT": 37, "NINE": 38, "ZERO": 39,
      "ENTER": 40, "ESCAPE": 41, "BACKSPACE": 42, "TAB": 43, "SPACEBAR": 44,
      "MINUS": 45, "EQUALS": 46, "LEFT_BRACKET": 47, "RIGHT_BRACKET": 48,
      "BACKSLASH": 49, "NON_US_HASH": 50, "SEMICOLON": 51, "QUOTE": 52,
      "GRAVE_ACCENT": 53, "COMMA": 54, "PERIOD": 55, "FORWARD_SLASH": 56,
      "CAPS_LOCK": 57,
      "F1": 58, "F2": 59, "F3": 60, "F4": 61, "F5": 62, "F6": 63,
      "F7": 64, "F8": 65, "F9": 66, "F10": 67, "F11": 68, "F12": 69,
      "PRINT_SCREEN": 70, "SCROLL_LOCK": 71, "PAUSE": 72,
      "INSERT": 73, "HOME": 74, "PAGE_UP": 75, "DELETE": 76,
      "END": 77, "PAGE_DOWN": 78, "RIGHT_ARROW": 79, "LEFT_ARROW": 80,
      "DOWN_ARROW": 81, "UP_ARROW": 82,
      "KEYPAD_NUMLOCK": 83, "KEYPAD_SLASH": 84,
      "KEYPAD_ASTERISK": 85, "KEYPAD_MINUS": 86, "KEYPAD_PLUS": 87,
      "KEYPAD_ENTER": 88, "KEYPAD_1": 89, "KEYPAD_2": 90,
      "KEYPAD_3": 91, "KEYPAD_4": 92, "KEYPAD_5": 93,
      "KEYPAD_6": 94, "KEYPAD_7": 95, "KEYPAD_8": 96,
      "KEYPAD_9": 97, "KEYPAD_0": 98, "KEYPAD_PERIOD": 99,
      "NON_US_BACKSLASH": 100, "APPLICATION": 101, "POWER": 102,
      "KEYPAD_EQUAL": 103,
      "F13": 104, "F14": 105, "F15": 106, "F16": 107,
      "F17": 108, "F18": 109, "F19": 110, "F20": 111,
      "F21": 112, "F22": 113, "F23": 114, "F24": 115,
      "INTERNATIONAL1": 135, "INTERNATIONAL2": 136, "INTERNATIONAL3": 137,
      "HENKAN": 138, "MUHENKAN": 139, "KANA_MAC": 144, "EISU_MAC": 145,
      "LEFT_CONTROL": 224, "LEFT_SHIFT": 225, "LEFT_ALT": 226,
      "LEFT_GUI": 227, "RIGHT_CONTROL": 228, "RIGHT_SHIFT": 229,
      "RIGHT_ALT": 230, "RIGHT_GUI": 231
    },
    "Android TV": {
      "DPAD_CENTER": 65, "DPAD_UP": 66, "DPAD_DOWN": 67,
      "DPAD_LEFT": 68, "DPAD_RIGHT": 69,
      "MENU": 64, "MENU_ESCAPE": 70,
      "HOME": 547, "BACK": 548, "FORWARD": 549,
      "SEARCH": 545, "EXIT": 148,
      "VOICE_COMMAND": 207, "ASSISTANT": 459,
      "RECENT_APPS": 671, "ALL_APPS": 674,
      "APP_SWITCH": 418, "SETTINGS": 415,
      "PROFILE_SWITCH": 412, "LOCK_SCREEN": 414,
      "LANGUAGE_SWITCH": 669, "SCREENSAVER": 433,
      "FULLSCREEN": 562,
      "POWER": 48, "SLEEP": 50,
      "TV": 137, "DVD": 140, "PC": 136,
      "GUIDE": 141, "GAMES": 143,
      "INPUT_SELECT": 130, "LAST_CHANNEL": 131,
      "ENTER_CHANNEL": 132
    },
    "Media": {
      "PLAY_PAUSE": 205, "PLAY": 176, "PAUSE": 177, "STOP": 183,
      "NEXT_TRACK": 181, "PREV_TRACK": 182,
      "FAST_FORWARD": 179, "REWIND": 180,
      "RECORD": 178, "EJECT": 184,
      "SHUFFLE": 185, "REPEAT": 188, "SLOW": 191,
      "FRAME_FORWARD": 192, "FRAME_BACK": 193,
      "MUTE": 226, "VOLUME_UP": 233, "VOLUME_DOWN": 234,
      "CHANNEL_UP": 156, "CHANNEL_DOWN": 157,
      "INFO": 96, "CAPTIONS": 97,
      "SNAPSHOT": 101, "STILL": 102,
      "PIP_TOGGLE": 103, "PIP_SWAP": 104,
      "RED": 105, "GREEN": 106, "BLUE": 107, "YELLOW": 108,
      "ASPECT_RATIO": 109,
      "BRIGHTNESS_UP": 111, "BRIGHTNESS_DOWN": 112,
      "AUDIO_TRACK": 371,
      "DICTATE": 216, "EMOJI_PICKER": 217,
      "DVR": 154, "TUNER": 147, "CABLE": 151, "SATELLITE": 152,
      "HELP": 149
    },
    "Browser & Apps": {
      "BROWSER": 406, "MAIL": 394, "CALCULATOR": 402,
      "MEDIA_PLAYER": 403, "MY_COMPUTER": 404,
      "REFRESH": 551, "BOOKMARKS": 554,
      "ZOOM_IN": 557, "ZOOM_OUT": 558,
      "SCROLL_UP": 563, "SCROLL_DOWN": 564,
      "AC_PAN": 568,
      "WORD_PROCESSOR": 406, "TEXT_EDITOR": 407,
      "SPREADSHEET": 408, "GRAPHICS_EDITOR": 409,
      "KEYBOARD_BRIGHTNESS_UP": 122, "KEYBOARD_BRIGHTNESS_DOWN": 123,
      "PHONE_MUTE": 47
    },
    "Mouse Buttons": {
      "BUTTON_1": 1, "BUTTON_2": 2, "BUTTON_3": 3, "BUTTON_4": 4,
      "BUTTON_5": 5, "BUTTON_6": 6, "BUTTON_7": 7, "BUTTON_8": 8
    },
    "System": {
      "SYSTEM_POWER_DOWN": 129, "SYSTEM_SLEEP": 130, "SYSTEM_WAKE_UP": 131
    }
  }
};

function getSourceList() {
  const list = [];
  for (const [cat, keys] of Object.entries(USAGES.source)) {
    for (const [name, code] of Object.entries(keys)) {
      list.push({ name, code, category: cat });
    }
  }
  return list;
}

function getTargetList() {
  const list = [];
  for (const [cat, keys] of Object.entries(USAGES.target)) {
    for (const [name, code] of Object.entries(keys)) {
      let type;
      if (cat === "Keyboard") type = "keyboard";
      else if (cat === "Mouse Buttons") type = "mouse";
      else if (cat === "System") type = "system";
      else type = "consumer";
      list.push({ name, code, category: cat, type });
    }
  }
  return list;
}
