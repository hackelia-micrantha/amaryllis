# Amaryllis Example Application

This directory contains a React Native application that demonstrates the usage of the `react-native-amaryllis` library.

## Prerequisites

Before running the example app, ensure you have the following installed:

- Node.js (check the root `.nvmrc` for the recommended version)
- Yarn
- Android Studio (for Android development)
- Xcode (for iOS development)

## Installation

This project is part of a Yarn workspaces monorepo. To install all dependencies, run the following command from the **root** directory of the project:

```sh
yarn
```

## Running the Application

The following commands are run from the **root** directory:

### 1. Start the Metro Bundler

```sh
yarn example start
```

### 2. Run on a Simulator or Device

With the Metro bundler running in a separate terminal, run one of the following commands:

**Android:**

```sh
yarn example android
```

**iOS:**

```sh
yarn example ios
```

## Project Structure

The main application code can be found in `src/App.tsx`. This file contains the primary UI and logic for interacting with the Amaryllis library.

`src/ChatPrompt.tsx` displays the chat text and input controls

`src/Header.tsx` displays the header and controls to create a new session

`src/PromptContext.ts` holds shared state for the components
