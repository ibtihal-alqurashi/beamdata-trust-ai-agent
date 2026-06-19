import os
import sys
import traceback
from datetime import datetime
from flask import Flask, request, jsonify, render_template

# ============================================================
# Path Setup
# ============================================================

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(PROJECT_DIR)

if PROJECT_DIR not in sys.path:
    sys.path.append(PROJECT_DIR)

os.chdir(ROOT_DIR)

# ============================================================
# Import Existing Agent Logic
# ============================================================

try:
    from agent import load_policies, build_vectorstore, build_chain, full_pipeline
    from llm_judge import judge_ticket
except Exception as import_error:
    print("[FATAL] Failed to import agent modules.")
    print(import_error)
    raise


# ============================================================
# Flask App Setup
# ============================================================

app = Flask(
    __name__,
    template_folder=os.path.join(PROJECT_DIR, "templates"),
    static_folder=os.path.join(PROJECT_DIR, "static"),
    static_url_path="/static"
)

# ============================================================
# Global Agent Objects
# ============================================================

policies = None
vectorstore = None
chain = None
agent_ready = False


# ============================================================
# Helper Functions
# ============================================================

def normalize_attack_types(attack_type):
    if not attack_type:
        return []

    if isinstance(attack_type, list):
        return attack_type

    if isinstance(attack_type, str):
        parts = [x.strip() for x in attack_type.replace(",", "|").split("|")]
        return [p for p in parts if p]

    return []


def normalize_action(action):
    if not action:
        return "allow"

    action = str(action).lower().strip()

    if action in ["block", "blocked", "deny", "refuse", "threat", "threat detected"]:
        return "block"
    return "allow"

def build_history_text(history):
    if not history or not isinstance(history, list):
        return ""

    lines = []

    for item in history:
        if not isinstance(item, dict):
            continue

        user_msg = item.get("user", "")
        assistant_msg = item.get("assistant", "")

        if user_msg:
            lines.append(f"User: {user_msg}")

        if assistant_msg:
            lines.append(f"Assistant: {assistant_msg}")

    return "\n".join(lines)


def safe_judge_ticket(user_input):
    result = judge_ticket(user_input)

    if not isinstance(result, dict):
        result = {}

    return {
        "action": normalize_action(result.get("action", "allow")),
        "risk_level": result.get("risk_level", "low"),
        "reason": result.get("reason", ""),
        "sensitive_intent_detected": result.get("sensitive_intent_detected", "0"),
        "roleplay_detected": result.get("roleplay_detected", "0"),
        "emotional_manipulation_detected": result.get("emotional_manipulation_detected", "0"),
        "crm_data_request_detected": result.get("crm_data_request_detected", "0"),
    }


def build_scores(judge_result):
    return {
        "sensitive_intent": str(judge_result.get("sensitive_intent_detected", "0")),
        "roleplay": str(judge_result.get("roleplay_detected", "0")),
        "emotional_manipulation": str(judge_result.get("emotional_manipulation_detected", "0")),
        "crm_data_request": str(judge_result.get("crm_data_request_detected", "0")),
    }


def log_security_attack(user_input, attack_types, action_taken, metadata=None):
    """
    Log ONLY detected attacks/security threats.
    Safe messages and escalation requests are not logged.
    """
    try:
        log_path = os.path.join(ROOT_DIR, "security_log.txt")
        metadata = metadata or {}

        with open(log_path, "a", encoding="utf-8") as log_file:
            log_file.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]\n")
            log_file.write("Status: ATTACK DETECTED\n")
            log_file.write(f"Attack Type: {', '.join(attack_types) if attack_types else 'Unknown Attack'}\n")
            log_file.write(f"User Input: {user_input}\n")
            log_file.write(f"Action: {action_taken}\n")
            if metadata:
                log_file.write(f"Metadata: {metadata}\n")
            log_file.write("--------------------------------------------------\n")
    except Exception as log_error:
        print("[WARNING] Failed to write security_log.txt")
        print(log_error)


def init_agent():
    global policies, vectorstore, chain, agent_ready

    if agent_ready:
        return

    print("[INFO] Initializing Beamdata Intelligent Agent...")

    knowledge_path = os.path.join(ROOT_DIR, "knowledge", "beamdata_knowledge_base.txt")

    if not os.path.exists(knowledge_path):
        raise FileNotFoundError(
            f"Knowledge base not found at: {knowledge_path}"
        )

    policies = load_policies()
    vectorstore = build_vectorstore(policies)
    chain = build_chain()

    agent_ready = True
    print("[SUCCESS] Beamdata agent initialized successfully.")


# ============================================================
# Routes
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "agent_ready": agent_ready,
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    global vectorstore, chain

    if not agent_ready:
        return jsonify({
            "reply": "The assistant is still initializing. Please try again in a moment.",
            "status": "ERROR",
            "attack_type": [],
            "terminate_session": False,
            "risk_level": "low",
            "action": "allow",
            "reason": "Agent is not initialized.",
            "scores": {
                "sensitive_intent": "0",
                "roleplay": "0",
                "emotional_manipulation": "0",
                "crm_data_request": "0"
            }
        }), 503

    data = request.get_json(silent=True) or {}

    user_input = str(data.get("message", "")).strip()
    history = data.get("history", [])

    if not user_input:
        return jsonify({
            "reply": "Please enter a message.",
            "status": "ERROR",
            "attack_type": [],
            "terminate_session": False,
            "risk_level": "low",
            "action": "allow",
            "reason": "Empty message.",
            "scores": {
                "sensitive_intent": "0",
                "roleplay": "0",
                "emotional_manipulation": "0",
                "crm_data_request": "0"
            }
        }), 400

    try:
        history_text = build_history_text(history)

        judge_result = safe_judge_ticket(user_input)
        judge_action = normalize_action(judge_result.get("action", "allow"))

        mock_row = {
            "ticket_text": user_input,
            "action": judge_action,
            "risk_level": judge_result.get("risk_level", "low"),
            "reason": judge_result.get("reason", "")
        }

        result = full_pipeline(
            vectorstore,
            chain,
            row=mock_row,
            history_text=history_text
        )

        if not isinstance(result, dict):
            result = {}

        backend_status = result.get("status", "ALLOWED")
        terminate_session = bool(result.get("terminate_session", False))
        attack_types = normalize_attack_types(result.get("attack_type", []))

        final_action = judge_action

        if terminate_session or str(backend_status).upper() == "THREAT DETECTED":
            final_action = "block"
            terminate_session = True

        reply = result.get("reply", "")

        if final_action == "block":
            if not reply:
                reply = "This request cannot be processed."

            log_security_attack(
                user_input=user_input,
                attack_types=attack_types,
                action_taken="Blocked and session terminated",
                metadata={
                    "risk_level": judge_result.get("risk_level", "low"),
                    "reason": judge_result.get("reason", ""),
                    "scores": build_scores(judge_result)
                }
            )

        if not reply:
            reply = "I’m sorry, I could not generate a response. Please try again."

        return jsonify({
            "reply": reply,
            "status": backend_status,
            "attack_type": attack_types,
            "terminate_session": terminate_session,
            "risk_level": judge_result.get("risk_level", "low"),
            "action": final_action,
            "reason": judge_result.get("reason", ""),
            "scores": build_scores(judge_result)
        })

    except Exception as e:
        print("[ERROR] Error in /api/chat")
        print(traceback.format_exc())

        return jsonify({
            "reply": "An error occurred while processing your request. Please try again.",
            "status": "ERROR",
            "attack_type": [],
            "terminate_session": False,
            "risk_level": "low",
            "action": "allow",
            "reason": str(e),
            "scores": {
                "sensitive_intent": "0",
                "roleplay": "0",
                "emotional_manipulation": "0",
                "crm_data_request": "0"
            }
        }), 500


@app.route("/api/select-mode", methods=["POST"])
def select_mode():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode")
    if mode == "explore_services":
        services = [
            "1. AI Strategy",
            "2. AI Implementation",
            "3. AI Infrastructure",
            "4. Data and Cloud Infrastructure",
            "5. Data Analytics and Data Science"
        ]
        return jsonify({"services": services})
    elif mode == "technical_support":
        return jsonify({
            "message": "Technical Support Mode Activated.\n\nPlease describe your issue or suggestion.\n💬 You can send up to 3 messages in this session."
        })
    return jsonify({"error": "Invalid mode"}), 400


@app.route("/api/service", methods=["POST"])
def service():
    global vectorstore, chain
    data = request.get_json(silent=True) or {}
    service_id = str(data.get("service_id", ""))
    
    service_map = {
        "1": "AI Strategy",
        "2": "AI Implementation",
        "3": "AI Infrastructure",
        "4": "Data and Cloud Infrastructure",
        "5": "Data Analytics and Data Science"
    }
    
    selected_service = service_map.get(service_id)
    if not selected_service:
        return jsonify({"error": "Invalid service ID"}), 400

    mock_row = {
        "ticket_text": selected_service,
        "action": "allow",
        "risk_level": "low",
        "reason": ""
    }

    result = full_pipeline(
        vectorstore,
        chain,
        row=mock_row,
        history_text="MODE: services"
    )

    if not isinstance(result, dict):
        result = {}

    reply = result.get("reply", "No information found.")
    
    # Append the exit message logic from agent.py
    exit_message = "\n\n🙏 Thank you for using Beamdata Services.\n\nIf you need anything else, feel free to contact us:\n📞 Contact Information\n- Contact Form: https://beamdata.ai/contact/\n- Email: info@beamdata.ai\n- Phone: 365-795-0102"
    
    return jsonify({"reply": reply + exit_message})


@app.route("/api/reset", methods=["POST"])
def reset_session():
    return jsonify({
        "status": "ok",
        "message": "Session reset."
    })


# ============================================================
# Main
# ============================================================

# Initialize the agent on startup/import (required for Gunicorn deployment)
init_agent()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)