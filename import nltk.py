import nltk
import sqlite3
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def calculate_sentence_similarity(sentence1, sentence2):
    # Preprocessing
    stop_words = set(stopwords.words('english'))
    tokenizer = word_tokenize
    stemmer = PorterStemmer()

    def preprocess_text(text):
        words = [w.lower() for w in tokenizer(text) if w.lower() not in stop_words]
        words = [stemmer.stem(w) for w in words]
        return " ".join(words)

    sentence1 = preprocess_text(sentence1)
    sentence2 = preprocess_text(sentence2)

    # Create TF-IDF vectors
    vectorizer = TfidfVectorizer()
    vectors = vectorizer.fit_transform([sentence1, sentence2])

    # Calculate cosine similarity
    similarity = cosine_similarity(vectors[0:1], vectors[1:2])[0][0]
    return similarity


conn = sqlite3.connect('faq.db')
c = conn.cursor()
##c.execute('''CREATE TABLE IF NOT EXISTS faqs
##question TEXT primary key, answer TEXT NOT NULL)''')
f=c.fetchall()
for i in f:
    print(f)
conn.commit()
conn.close()


def get_answer(question):
    conn = sqlite3.connect('faq.db')
    c = conn.cursor()
    c.execute("SELECT answer FROM faqs WHERE question=?", (question,))  
    answer = c.fetchone()
    conn.close()
    if answer:
        return answer[0]
    else:
        print("\nI don't have an answer for that yet, Kindly wait for the faculty to answer your question\n")
        insert_faq(question, '0')  
        return None

def main():
    global c 
    print("FAQ Chatbox")
    while True:
        role = input('\nAre you student or a faculty(s/f)? ')
        if role.lower() == 's':
            question = input("Ask a question (or type 'exit' to quit): ")
            if question.lower() == 'exit':
                break
            q=c.execute('''select question from faqs;''')
            for i in q:
                f=i[0]
                similarity_score = calculate_sentence_similarity(question, f)
                if similarity_score>0.7:
                    question=f
                    answer = get_answer(question)  
            if answer:
                print(f"Q: {question}\nA: {answer}\n")
        elif role == 'f':
            conn = sqlite3.connect('faq.db')
            c = conn.cursor()
            c.execute("SELECT * FROM faqs WHERE answer='0';")
            questions = c.fetchall()
            for row in questions:
                print(f"Q: {row[1]}")
                answer = input('Enter the answer for the given question: ')
                update_answer(row[1], answer)
            if questions==[]:
                print('\nAll the questions in the database are answered, Come again later\n')
                break
            conn.close()

def insert_faq(question, answer):
    conn = sqlite3.connect('faq.db')
    c = conn.cursor()
    c.execute("INSERT INTO faqs (question, answer) VALUES (?, ?)", (question, answer))
    conn.commit()
    conn.close()

def update_answer(question, answer):
    conn = sqlite3.connect('faq.db')
    c = conn.cursor()
    c.execute("UPDATE faqs SET answer=? WHERE question=?", (answer, question))
    conn.commit()
    conn.close()

if __name__ == '__main__':
    main()


