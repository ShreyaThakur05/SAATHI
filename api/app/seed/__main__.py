from app.db.session import get_session
from app.seed.demo import seed_demo, seed_staff

if __name__ == "__main__":
    with next(get_session()) as session:
        ids = seed_demo(session)
        seed_staff(session)
    print("seeded" if ids else "already seeded", ids)
