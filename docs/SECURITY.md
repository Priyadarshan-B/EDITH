# EDITH – Security Architecture & Safety Policies

## 1. Threat Model & Design Philosophy

As an assistant with desktop automation capabilities, EDITH enforces defensive boundaries:
- **No Direct Shell Injection**: User text from conversations is never passed directly into `shell=True` or `eval()`.
- **Pre-Execution Tiering**: Every action is assigned a risk level based on potential irreversibility.
- **Dual-Channel Confirmation**: Sensitive commands can be authorized by voice; destructive operations strictly require clicking a confirmation modal in the GUI.
- **Post-Execution State Verification**: EDITH never assumes an OS action succeeded; it actively re-checks the process table or filesystem.

## 2. Risk Classification Matrix

```
+------------------------+-------------------+----------------------------+-----------------------------+
| Tier Level             | Description       | Examples                   | Authorization Requirement   |
+------------------------+-------------------+----------------------------+-----------------------------+
| 1. Read-Only           | Non-mutating      | CPU telemetry, file read,  | Autonomous (logged)         |
|                        | telemetry         | search files, app list     |                             |
+------------------------+-------------------+----------------------------+-----------------------------+
| 2. Low-Risk Reversible | Non-destructive   | Launch whitelisted app,    | Auto-approved or voice      |
|                        | window/sound      | minimize window, mute sound| toggle                      |
+------------------------+-------------------+----------------------------+-----------------------------+
| 3. Sensitive           | Workspace mutate  | Edit text file, make dir,  | Spoken challenge phrase:    |
|                        | or kill process   | terminate process          | "Confirm proceed"           |
+------------------------+-------------------+----------------------------+-----------------------------+
| 4. Destructive /       | Irreversible or   | Delete file, execute shell | Mandatory Tauri GUI card    |
|    Privileged          | privileged        | command, registry edit     | with exact diff preview     |
+------------------------+-------------------+----------------------------+-----------------------------+
```

## 3. Directory Jailing & Forbidden Shell Patterns
- Modifiable directories are restricted to `%USERPROFILE%` and user project roots.
- Modifying `C:\Windows` or system directories is blocked unconditionally.
- Destructive commands (`rmdir /s`, `format`, `reg delete`, `Remove-Item -Recurse C:\`) trigger immediate rejection and security audit logging.
