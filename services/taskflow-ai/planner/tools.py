"""Reviewed intent registry used by the semantic router.

Only the `smalltalk` intent is short-circuited by the gateway today (answered without the LLM).
Every other intent falls through to the LLM plus the gateway's existing, permission-checked handlers.
Examples cover English, Hindi/Gujarati in Roman script, and common typos.
"""

TOOLS = {
    "smalltalk": {
        "risk": "none",
        "examples": [
            "hello", "hi", "hey there", "good morning", "thanks", "thank you", "ok", "okay cool",
            "namaste", "kem cho", "kaise ho", "shukriya", "aabhar", "hii", "helo",
        ],
    },
    "list_tasks": {
        "risk": "read",
        "examples": [
            "show my tasks", "what tasks are pending", "list tasks due today", "which tasks are overdue",
            "mere tasks dikhao", "aaj ke kaam", "mara tasks batavo",
        ],
    },
    "list_meetings": {
        "risk": "read",
        "examples": ["what meetings do I have", "meetings today", "upcoming meetings", "meeting kab hai"],
    },
    "workload": {
        "risk": "read",
        "examples": ["who has the most work", "team workload", "how many tasks does Ravi have", "kiske paas zyada kaam hai"],
    },
    "create_task": {
        "risk": "write",
        "examples": ["create a task to call the client", "add task prepare report tomorrow", "naya task banao", "task add karo"],
    },
    "update_task": {
        "risk": "write",
        "examples": ["mark the report task as done", "change priority to high", "assign this task to Priya", "task complete karo"],
    },
}
