#!/usr/bin/env python3
"""
激活码生成工具
用法: python generate_key.py
每次运行生成当前时间窗口的激活码
"""

import hmac
import hashlib
import time

PRODUCT_KEY = "pdf-page-manager-secret-key-2026"  # 必须与 license.rs 中的密钥一致
TIME_WINDOW_SECS = 600  # 10分钟

def current_time_window():
    return int(time.time()) // TIME_WINDOW_SECS

def time_window_to_string(window):
    start = window * TIME_WINDOW_SECS
    # 格式化: YYYY-MM-DD-HH-MM
    time_str = time.strftime("%Y-%m-%d-%H-%M", time.gmtime(start))
    return time_str

def generate_activation_code():
    window = current_time_window()
    time_str = time_window_to_string(window)

    mac = hmac.new(
        PRODUCT_KEY.encode('utf-8'),
        time_str.encode('utf-8'),
        hashlib.sha256
    ).digest()

    part1 = int.from_bytes(mac[0:4], 'big') % 10000
    part2 = int.from_bytes(mac[4:8], 'big') % 10000
    part3 = int.from_bytes(mac[8:12], 'big') % 10000

    code = f"{part1:04d}{part2:04d}{part3:04d}"
    # 格式化为 XXXX-XXXX-XXXX
    return f"{code[0:4]}-{code[4:8]}-{code[8:12]}"

def main():
    print("=" * 40)
    print("PDF Page Manager 激活码生成器")
    print("=" * 40)
    print()
    print(f"当前时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"时间窗口: {time_window_to_string(current_time_window())}")
    print()
    print(f"激活码: {generate_activation_code()}")
    print()
    print("提示: 激活码在当前30分钟窗口内有效")
    print("      买家需要在App显示的激活码输入框中输入此码")

if __name__ == "__main__":
    main()
