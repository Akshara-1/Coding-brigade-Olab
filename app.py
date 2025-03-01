from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from openai import OpenAI
import hashlib
import bcrypt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import uuid
import smtplib
from email.mime.text import MIMEText
import random

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key="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")  # Replace with your OpenAI API key

sessions = {}
reset_codes = {}
used_codes = set()

def init_db():
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, dob TEXT, email TEXT UNIQUE, contact TEXT, role TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS scores 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, subject TEXT, score INTEGER, attempted INTEGER DEFAULT 1, UNIQUE(user_id, subject))''')
    c.execute('''CREATE TABLE IF NOT EXISTS faqs 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, question TEXT NOT NULL, answer TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS community 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, text TEXT)''')
    faculty_password = bcrypt.hashpw("Faculty123!".encode(), bcrypt.gensalt()).decode()
    c.execute("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)", 
              ("faculty", faculty_password, "faculty"))
    conn.commit()
    conn.close()

init_db()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def check_password(password, hashed):
    return bcrypt.checkpw(password.encode(), hashed.encode())

def verify_token():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token in sessions:
        return sessions[token]
    return None

def generate_unique_code():
    max_attempts = 1000
    for _ in range(max_attempts):
        code = str(random.randint(100000, 99999999))
        if code not in used_codes:
            used_codes.add(code)
            return code
    raise Exception("Unable to generate a unique code")

def send_email(to_email, code):
    from_email = "your-email@gmail.com"  # Replace with your Gmail address
    password = "your-app-password"       # Replace with your Gmail App Password
    sender_name = "OLabs"

    subject = "OLabs Password Reset Code"
    body = f"Your reset code is: {code}"
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = f"{sender_name} <{from_email}>"
    msg['To'] = to_email

    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(from_email, password)
            server.send_message(msg)
            print(f"Email sent successfully to {to_email} with code: {code}")
    except smtplib.SMTPAuthenticationError:
        print("SMTP Authentication Error: Check email and password")
        raise
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        raise

def find_similar_question(new_question):
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT question, answer FROM faqs WHERE answer != '0'")
    faqs = c.fetchall()
    conn.close()

    if not faqs:
        return None

    questions = [faq[0] for faq in faqs]
    answers = [faq[1] for faq in faqs]
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(questions + [new_question])
    similarity = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1])

    max_similarity_idx = similarity.argmax()
    if similarity[0, max_similarity_idx] > 0.7:
        return answers[max_similarity_idx]
    return None

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    dob = data.get('dob')
    email = data.get('email')
    contact = data.get('contact')

    if not all([name, username, password, dob, email, contact]):
        return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    try:
        hashed = hash_password(password)
        c.execute("INSERT INTO users (name, username, password, dob, email, contact) VALUES (?, ?, ?, ?, ?, ?)", 
                  (name, username, hashed, dob, email, contact))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Username or email already exists'}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'status': 'error', 'message': 'Username and password are required'}), 400

    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT id, password, role FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    if user and (username == "faculty" and check_password(password, user[1]) or 
                 username != "faculty" and hash_password(password) == user[1]):
        token = str(uuid.uuid4())
        sessions[token] = user[0]
        conn.close()
        return jsonify({'user_id': user[0], 'username': username, 'role': user[2], 'token': token})
    conn.close()
    return jsonify({'status': 'error', 'message': 'Invalid credentials'}), 401

@app.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({'status': 'error', 'message': 'Email is required'}), 400

    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE email = ?", (email,))
    user = c.fetchone()
    if user:
        try:
            code = generate_unique_code()
            reset_codes[email] = code
            send_email(email, code)
            conn.close()
            return jsonify({'status': 'success'})
        except Exception as e:
            conn.close()
            return jsonify({'status': 'error', 'message': f'Failed to send email: {str(e)}'}), 500
    conn.close()
    return jsonify({'status': 'error', 'message': 'Email not found'}), 404

@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    email = data.get('email')
    code = data.get('code')
    new_password = data.get('new_password')

    if not all([email, code, new_password]):
        return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

    if email in reset_codes and reset_codes[email] == code:
        conn = sqlite3.connect('olabs.db')
        c = conn.cursor()
        hashed = hash_password(new_password)
        c.execute("UPDATE users SET password = ? WHERE email = ?", (hashed, email))
        conn.commit()
        conn.close()
        del reset_codes[email]
        used_codes.remove(code)
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Invalid reset code'}), 400

@app.route('/logout', methods=['POST'])
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token in sessions:
        del sessions[token]
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Invalid or expired token'}), 401

@app.route('/check-quiz-attempt', methods=['GET'])
def check_quiz_attempt():
    user_id = request.args.get('user_id')
    subject = request.args.get('subject')
    if not verify_token() or not user_id or not subject:
        return jsonify({'status': 'error', 'message': 'Unauthorized or missing parameters'}), 401

    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT attempted FROM scores WHERE user_id = ? AND subject = ?", (user_id, subject))
    result = c.fetchone()
    conn.close()
    return jsonify({'attempted': bool(result)})  # True if attempted, False if not

@app.route('/scores', methods=['POST'])
def save_score():
    user_id = verify_token()
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    data = request.json
    subject = data.get('subject')
    score = data.get('score')

    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    try:
        c.execute("INSERT INTO scores (user_id, subject, score) VALUES (?, ?, ?)", (user_id, subject, score))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'status': 'error', 'message': 'Quiz already attempted'}), 400

@app.route('/scores', methods=['GET'])
def get_scores():
    if not verify_token():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    subject = request.args.get('subject', 'Overall')
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    if subject == 'Overall':
        c.execute("SELECT u.username, SUM(s.score) as total_score FROM scores s JOIN users u ON s.user_id = u.id GROUP BY u.id, u.username")
    else:
        c.execute("SELECT u.username, MAX(s.score) as score FROM scores s JOIN users u ON s.user_id = u.id WHERE s.subject = ? GROUP BY u.id, u.username", (subject,))
    scores = [{'username': row[0], 'score': row[1]} for row in c.fetchall()]
    scores.sort(key=lambda x: x['score'], reverse=True)
    conn.close()
    return jsonify(scores)

@app.route('/scores/clear', methods=['POST'])
def clear_scores():
    if not verify_token():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    data = request.json
    password = data.get('password')
    if password == 'admin123':
        conn = sqlite3.connect('olabs.db')
        c = conn.cursor()
        c.execute("DELETE FROM scores")
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Incorrect password'}), 403

@app.route('/chatbox/history', methods=['GET'])
def get_user_chat_history():
    user_id = verify_token()
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
        
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    try:
        c.execute("SELECT question, answer, timestamp FROM faqs WHERE user_id = ? ORDER BY timestamp DESC", (user_id,))
        history = [{'question': row[0], 'answer': row[1], 'timestamp': row[2]} for row in c.fetchall()]
        conn.close()
        return jsonify({'history': history})
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'status': 'error', 'message': f'Database error: {str(e)}'}), 500

@app.route('/chatbox/unanswered', methods=['GET'])
def get_unanswered_questions():
    if not verify_token():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT id, question, timestamp FROM faqs WHERE answer = '0'")
    questions = [{'id': row[0], 'question': row[1], 'timestamp': row[2]} for row in c.fetchall()]
    conn.close()
    return jsonify({'questions': questions})

@app.route('/chatbox', methods=['GET'])
def get_chatbox_history():
    user_id = verify_token()
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    # Prevent chatbox history from being shown
    return jsonify({'status': 'error', 'message': 'Chatbox history is not available'}), 403


@app.route('/chatbox', methods=['POST'])
def send_chatbox_message():
    user_id = verify_token()
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    data = request.json
    question = data.get('question')
    role = data.get('role')
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()

    if role == 'student':
        c.execute("SELECT answer FROM faqs WHERE question = ? AND answer != '0'", (question,))
        answer = c.fetchone()
        if answer:
            conn.close()
            return jsonify({'answer': answer[0], 'status': 'answered'})
        
        similar_answer = find_similar_question(question)
        if similar_answer:
            conn.close()
            return jsonify({'answer': similar_answer, 'status': 'answered'})
        
        c.execute("INSERT INTO faqs (user_id, question, answer) VALUES (?, ?, '0')", (user_id, question))
        conn.commit()
        conn.close()
        return jsonify({'status': 'pending', 'message': "Question submitted! Waiting for faculty response."})
    
    elif role == 'faculty':
        answer = data.get('answer')
        faq_id = data.get('faq_id')
        c.execute("UPDATE faqs SET answer = ? WHERE id = ? AND answer = '0'", (answer, faq_id))
        rows_affected = c.rowcount
        conn.commit()
        conn.close()
        if rows_affected > 0:
            return jsonify({'status': 'success', 'message': 'Answer recorded'})
        return jsonify({'status': 'error', 'message': 'Question already answered or not found'}), 400

@app.route('/chatbox/search', methods=['GET'])
def search_faqs():
    if not verify_token():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    query = request.args.get('query', '')
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT question, answer FROM faqs WHERE answer != '0' AND question LIKE ?", (f'%{query}%',))
    results = [{'question': row[0], 'answer': row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify(results)

@app.route('/chatbot', methods=['POST'])
def chatbot():
    if not verify_token():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    data = request.json
    messages = data.get('messages', [])
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )
    response = completion.choices[0].message.content
    return jsonify({'response': response})

@app.route('/community', methods=['GET'])
def get_community_history():
    if not verify_token():
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("SELECT u.username, c.text FROM community c JOIN users u ON c.user_id = u.id")
    history = [{'user': row[0], 'text': row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify(history)

@app.route('/community', methods=['POST'])
def send_community_message():
    user_id = verify_token()
    if not user_id:
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    data = request.json
    text = data.get('text')
    conn = sqlite3.connect('olabs.db')
    c = conn.cursor()
    c.execute("INSERT INTO community (user_id, text) VALUES (?, ?)", (user_id, text))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)