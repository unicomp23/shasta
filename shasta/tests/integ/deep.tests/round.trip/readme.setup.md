# Project Walkthrough

This walkthrough will guide you through the process of installing Docker Desktop on a MacBook, running the worker container, and executing `npm test` within the container.

## Step 1: Install Docker Desktop

1. Visit the official Docker Desktop download page for Mac: [Docker Desktop for Mac](https://hub.docker.com/editions/community/docker-ce-desktop-mac/)
2. Click the "Get Docker" button to download the Docker DMG file.
3. Once the download is complete, double-click the DMG file to open it and Install Docker Desktop by dragging the Docker.app icon to the Applications folder.
4. Open Docker Desktop from the Applications folder or Launchpad.
5. If prompted, authorize Docker Desktop with your system password.
6. Wait for Docker to finish starting and ensure its status is "Running".

## Step 2: Clone the Project and Start the Services

1. Clone the project repository to your local machine, if you haven't done so already.
2. Open a terminal and navigate to the project directory where `docker-compose.yml` is located.
3. Run the following command to start the services:

```
./shasta/docker-up.sh
```

## Step 3: Open the Terminal for the Worker Container

1. Open Docker Desktop, and on the left-hand menu, click "Containers/Apps".
2. Locate the "kafka_worker" service listed under your desired project.
3. Click on the "kafka_worker" service and then click the "CLI" icon to open a terminal window inside the worker container.

## Step 4: Run npm Commands Inside the Container

1. Inside the terminal, navigate to the project source code folder:

```
cd /root/src
```

2. Install the necessary npm packages:

```
npm i
```

3. Run the tests in the container:

```
npm test
```

This will execute the tests using the worker container environment.

## Step 5: Clean Up

When you're done working with the project, you can stop the services by running the following command in the project directory:

```
./shasta/docker-down.sh
```

That's it! You've successfully installed Docker Desktop, set up the worker container, and executed tests inside the container.
