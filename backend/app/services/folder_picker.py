import platform
import subprocess


def pick_folder(prompt: str) -> str | None:
    if platform.system() == "Darwin":
        script = f'POSIX path of (choose folder with prompt "{prompt}")'
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if result.returncode != 0:
            return None
        return result.stdout.strip() or None

    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askdirectory(title=prompt)
        root.destroy()
        return selected or None
    except Exception:
        return None
