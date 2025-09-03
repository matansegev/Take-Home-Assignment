# Jira CLI Tool

A command-line interface application that integrates with Jira for project management. This tool allows you to create, fetch, and delete Jira issues directly from your terminal.

## Features

- **Setup**: Configure the app to connect to Jira using email and API token
- **Get an Issue**: Retrieve and display a specific Jira issue with interactive project and issue selection
- **Create an Issue**: Add a new Jira issue based on user input with interactive project selection
- **Delete an Issue**: Delete an existing Jira issue with confirmation step
- **Error Handling**: Comprehensive error handling with clear, user-friendly messages
- **Interactive UI**: Menu-driven interface with clear prompts and feedback

## Installation

1. Clone or download this repository
2. Navigate to the project directory:
   ```bash
   cd HomeTest
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Setup

### Option 1: Using .env file (Recommended)

1. Create a `.env` file in the project root
2. Add your Jira credentials:
   ```
   JIRA_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-api-token-here
   ```
3. The base URL will be auto-generated from your email domain

### Option 2: Manual input

Run the application and choose to enter credentials manually when prompted.

## Getting Your API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Jira CLI Tool")
4. Copy the generated token

## Usage

Start the application:
```bash
npm start
```

The application will guide you through:
1. **Setup**: Configure your Jira credentials
2. **Main Menu**: Choose from available actions:
   - Get an issue
   - Create an issue
   - Delete an issue
   - Exit

## Example Usage

```
🎯 Welcome to Jira CLI Tool!

🔧 Jira Setup Menu
How would you like to configure your credentials?
1. 📁 Use .env file (if available)
2. ✏️  Enter credentials manually
========================================
Please enter your choice (1 or 2): 1

✅ Using credentials from .env file!
📧 Email: your-email@example.com
🌐 Base URL: https://your-domain.atlassian.net

What would you like to do?
1. 🔍 Get an issue
2. ➕ Create an issue
3. 🗑️  Delete an issue
4. 🚪 Exit
==============================
```

## Requirements

- Node.js (v14 or higher)
- Valid Jira account with API access
- Internet connection

## Dependencies

- `axios`: HTTP client for API requests
- `dotenv`: Environment variable management
- `readline`: Interactive command-line interface

## Error Handling

The application includes comprehensive error handling for:
- Invalid credentials
- Network connectivity issues
- Permission errors
- Invalid project/issue keys
- API rate limiting

## AI Disclosure

This project was developed with assistance from AI tools including:
- Code generation and debugging
- Documentation writing
- Error handling implementation
- Understanding Jira API integration and authentication (collaborated with ChatGPT)


## License

MIT License
