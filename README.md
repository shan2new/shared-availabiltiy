# Availability Sharing Application

This is an Availability Sharing Application that allows users to create availability slots, block specific time slots, and view or update their availabilities.

## Requirements

- **Node.js version**: `16.19.1`
- **npm**: Installed with Node.js
- **nvm**: (Node Version Manager) for managing Node.js versions.

## Setting Up Node.js with nvm

If you don't have **Node.js** installed or are using a different version, follow these instructions to set it up with **nvm**.

1. **Install nvm** (Node Version Manager) by running the following commands:
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
    ```

2. **Reload your shell** (or restart the terminal):
    ```bash
    source ~/.bashrc
    ```

3. **Install the required Node.js version (16.19.1)**:
    ```bash
    nvm install 16.19.1
    ```

4. **Use the installed Node.js version**:
    ```bash
    nvm use 16.19.1
    ```

5. **Verify the Node.js version**:
    ```bash
    node -v
    ```

You should see: v16.19.1



## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/shan2new/shared-availabiltiy
    cd shared-availabiltiy
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

## Running the Application

1. To run the application with **seed data**, use the following command:
    ```bash
    npm run dev
    ```

   This will start the application and seed the database with initial users and availability data.

2. Once the server is running, the application will be accessible at:
    ```
    http://localhost:3000
    ```

## Running Tests

To run the tests, execute the following command:
```bash
npm test

