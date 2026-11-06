from flask import Blueprint, jsonify, request
from models import Employee, db
from blockchain import contract, w3, get_connection_status
import traceback
from werkzeug.security import generate_password_hash, check_password_hash

main = Blueprint("main", __name__)

# ─────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────
@main.route("/")
def home():
    return jsonify({
        "status": "Backend Running",
        "blockchain_connected": get_connection_status()
    })

# ─────────────────────────────────────────
# AUTH — SIGNUP
# ─────────────────────────────────────────
@main.route("/api/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()

        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not name or not email or not password:
            return jsonify({"error": "All fields are required"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must contain at least 6 characters"}), 400

        if Employee.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        employee = Employee(
            name=name,
            email=email,
            role="employee",
            status="active",
            password_hash=generate_password_hash(password)
        )

        db.session.add(employee)
        db.session.commit()

        return jsonify({
            "message": "Registration successful",
            "user": employee.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@main.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "")

    employee = Employee.query.filter_by(
        email=email,
        role=role
    ).first()

    if not employee or not employee.password_hash:
        return jsonify({"error": "Invalid credentials"}), 401

    if not check_password_hash(employee.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    if employee.status != "active":
        return jsonify({"error": "Account is inactive"}), 403

    return jsonify({
        "message": "Login successful",
        "user": employee.to_dict()
    }), 200

# ─────────────────────────────────────────
# EMPLOYEES
# ─────────────────────────────────────────
@main.route("/api/employees", methods=["GET"])
def get_employees():
    employees = Employee.query.all()
    return jsonify([e.to_dict() for e in employees])

@main.route("/api/employees/<int:emp_id>", methods=["GET"])
def get_employee(emp_id):
    emp = Employee.query.get_or_404(emp_id)
    return jsonify(emp.to_dict())


@main.route("/api/employees", methods=["POST"])
def create_employee():
    try:
        data = request.get_json() or {}

        name = data.get("name", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        department = data.get("department")
        wallet_address = data.get("wallet_address") or None
        status = data.get("status", "active")

        if not name or not email or not password:
            return jsonify({"error": "Name, email and password are required"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must contain at least 6 characters"}), 400

        if Employee.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        if wallet_address:
            wallet_address = w3.to_checksum_address(wallet_address)

        emp = Employee(
            name=name,
            email=email,
            role="employee",
            department=department,
            wallet_address=wallet_address,
            status=status,
            password_hash=generate_password_hash(password)
        )

        db.session.add(emp)
        db.session.commit()

        return jsonify(emp.to_dict()), 201

    except ValueError:
        db.session.rollback()
        return jsonify({"error": "Invalid Ethereum wallet address"}), 400

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# ALL GRANTS — must be ABOVE /<wallet_address>
# ─────────────────────────────────────────
@main.route("/api/grants/all", methods=["GET"])
def get_all_grants():
    try:
        employees = Employee.query.filter(
            Employee.wallet_address != None,
            Employee.role == "employee"
        ).all()
        all_grants = []
        for emp in employees:
            try:
                address = w3.to_checksum_address(emp.wallet_address)
                grant_ids = contract.functions.getEmployeeGrants(address).call()
                for gid in grant_ids:
                    g = contract.functions.getGrantDetails(gid).call()
                    # g[0]=employeeAddress, g[1]=employeeName, g[2]=totalShares,
                    # g[3]=vestedShares, g[4]=exercisedShares, g[5]=grantDate, g[6]=isActive
                    all_grants.append({
                        "grantId": gid,
                        "employeeName": emp.name,
                        "department": emp.department,
                        "employeeAddress": g[0],
                        "totalShares": g[2],
                        "vestedShares": g[3],
                        "exercisedShares": g[4],
                        "grantDate": g[5],
                        "isActive": g[6]
                    })
            except Exception as inner_e:
                print(f"Error fetching grants for {emp.name}: {inner_e}")
                continue
        return jsonify(all_grants)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# GRANTS — Create (ADMIN_ROLE required)
# ─────────────────────────────────────────

@main.route("/api/grants", methods=["POST"])
def create_grant():
    try:
        data = request.get_json() or {}

        employee_email = data.get("employeeEmail", "").strip().lower()
        employee_name = data.get("employeeName", "").strip()
        employee_address = w3.to_checksum_address(
            data["employeeAddress"]
        )
        total_shares = int(data["totalShares"])
        cliff_period = int(data.get("cliffPeriod", 365))
        vesting_duration = int(data.get("vestingDuration", 1460))

        if not employee_email or not employee_name:
            return jsonify({"error": "Employee details are required"}), 400

        if total_shares <= 0:
            return jsonify({"error": "Shares must be greater than zero"}), 400

        employee = Employee.query.filter_by(
            email=employee_email,
            role="employee"
        ).first()

        if not employee:
            return jsonify({"error": "Employee not found"}), 404

        sender = w3.eth.accounts[0]

        tx_hash = contract.functions.createGrant(
            employee_address,
            employee_name,
            total_shares,
            cliff_period,
            vesting_duration
        ).transact({"from": sender, "gas": 500000})

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status != 1:
            return jsonify({"error": "Blockchain transaction failed"}), 500

        # Save wallet address only after successful blockchain transaction
        employee.wallet_address = employee_address
        db.session.commit()

        return jsonify({
            "message": "Grant created successfully",
            "txHash": receipt.transactionHash.hex(),
            "employeeAddress": employee_address
        }), 201

    except ValueError:
        db.session.rollback()
        return jsonify({"error": "Invalid wallet address or grant values"}), 400

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# GRANTS — Read by wallet address
# ─────────────────────────────────────────
@main.route("/api/grants/<string:wallet_address>", methods=["GET"])
def get_employee_grants(wallet_address):
    try:
        address = w3.to_checksum_address(wallet_address)
        grant_ids = contract.functions.getEmployeeGrants(address).call()
        grants = []
        for gid in grant_ids:
            g = contract.functions.getGrantDetails(gid).call()
            # g[0]=employeeAddress, g[1]=employeeName, g[2]=totalShares,
            # g[3]=vestedShares, g[4]=exercisedShares, g[5]=grantDate, g[6]=isActive
            grants.append({
                "grantId": gid,
                "employeeAddress": g[0],
                "employeeName": g[1],
                "totalShares": g[2],
                "vestedShares": g[3],
                "exercisedShares": g[4],
                "grantDate": g[5],
                "isActive": g[6]
            })
        return jsonify(grants)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# EXERCISE SHARES
# ─────────────────────────────────────────
@main.route("/api/grants/<int:grant_id>/exercise", methods=["POST"])
def exercise_shares(grant_id):
    try:
        data = request.get_json()
        shares_to_exercise = int(data["shares"])
        wallet_address = w3.to_checksum_address(data["walletAddress"])
        tx_hash = contract.functions.exerciseShares(
            grant_id, shares_to_exercise
        ).transact({"from": wallet_address, "gas": 300000})
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return jsonify({
            "message": "Shares exercised successfully",
            "txHash": receipt.transactionHash.hex()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# UPDATE VESTING
# ─────────────────────────────────────────
@main.route("/api/grants/<int:grant_id>/update-vesting", methods=["POST"])
def update_vesting(grant_id):
    try:
        sender = w3.eth.accounts[0]
        tx_hash = contract.functions.updateVesting(grant_id).transact(
            {"from": sender, "gas": 300000}
        )
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return jsonify({
            "message": "Vesting updated",
            "txHash": receipt.transactionHash.hex()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# REVOKE GRANT
# ─────────────────────────────────────────
@main.route("/api/grants/<int:grant_id>/revoke", methods=["POST"])
def revoke_grant(grant_id):
    try:
        sender = w3.eth.accounts[0]
        tx_hash = contract.functions.revokeGrant(grant_id).transact(
            {"from": sender, "gas": 300000}
        )
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        return jsonify({
            "message": "Grant revoked",
            "txHash": receipt.transactionHash.hex()
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────
# ESOP POOL INFO
# ─────────────────────────────────────────
@main.route("/api/pool", methods=["GET"])
def get_pool():
    try:
        available = contract.functions.getAvailablePool().call()
        return jsonify({"availablePool": available})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500