Alright Welcome. This readme has certain assumptions that one
know the basics of Git and Docker.

The prerequisites include that you have Docker Desktop installed.
It also assumes that you have git installed and have a github account.

First clone the repo. https://github.com/HarryH20/BRIGHTS2.git. This can be done in pycharm
which is easiest or from the command line.

Checkout to the master branch and pull it. Create a new branch and name it after your first name.
Again this can be done from the UI in pycharm or from the command line. Pull the master branch into your branch.

Checkout into your branch.

Run docker compose up --build from the command line.

To stop the container run docker compose stop.
To start run docker compose start.

If you have any questions ask Harrison or better ask ChatGPT.



Start the Frontend (React)

The React application lives in the frontend/ directory.

From the project root, run:

cd frontend

npm install

npm run dev

Once the development server starts, open your browser and navigate to:

👉 http://localhost:5173

You should see the React login page running locally

