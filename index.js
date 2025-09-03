import axios from 'axios';
import readline from 'readline';
import dotenv from 'dotenv';

// Global variables
let baseURL = '';
let email = '';
let apiToken = '';

// ================================
// HELPER FUNCTIONS
// ================================

// Save login credentials and generate Jira URL automatically
function setCredentials(jiraEmail, jiraToken) {
  email = jiraEmail;
  apiToken = jiraToken;
  
  // Auto-generate baseURL from email
  baseURL = generateBaseURLFromEmail(jiraEmail);
}

// Create Jira URL from email domain
function generateBaseURLFromEmail(email) {
  if (!email || !email.includes('@')) {
    return ''; // No fallback - let user provide valid email
  }
  
  // Extract domain from email (part before @)
  const domain = email.split('@')[0];
  return `https://${domain}.atlassian.net`;
}

// Convert API errors to simple messages
function formatJiraError(error) {
  if (error.response?.data?.errorMessages?.[0]) {
    return error.response.data.errorMessages[0];
  } else if (error.response?.data?.errors) {
    const errors = Object.values(error.response.data.errors);
    return errors.join(', ');
  } else if (error.response && error.response.status === 401) {
    return 'Authentication failed. Please check your email and API token.';
  } else if (error.response && error.response.status === 403) {
    return 'Access denied. You may not have permission for this action.';
  } else if (error.response && error.response.status === 404) {
    return 'Resource not found. Please check the issue key or project key.';
  } else if (error.message) {
    return error.message;
  }
  return 'Unknown error occurred';
}

// Format text for Jira description
function formatDescriptionForJira(description) {
  if (!description || !description.trim()) {
    return null;
  }
  
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: description.trim()
          }
        ]
      }
    ]
  };
}


// ================================
// API FUNCTIONS
// ================================

// Make API requests to Jira
async function makeJiraRequest(path, options = {}) {
  const url = `${baseURL}/rest/api/3${path}`;
  const method = options.method || 'GET';
  
  const config = { 
    url, 
    method,
    auth: {
      username: email,
      password: apiToken
    },
    headers: {
      'Accept': 'application/json'
    }
  };
  
  if (options.body && (method === 'POST' || method === 'PUT')) {
    config.data = options.body;
    config.headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await axios(config);
    // For DELETE requests, there's usually no response data
    if (method === 'DELETE') {
      return { success: true, data: null };
    }
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: formatJiraError(error)
    };
  }
}

// Get current user info
async function getCurrentUser() {
  return await makeJiraRequest('/myself');
}

// Get list of projects
async function getProjectsList() {
  return await makeJiraRequest('/project');
}

// Get project details
async function getProject(projectKey) {
  if (!projectKey || !projectKey.trim()) {
    return { success: false, error: 'Project key is required' };
  }

  return await makeJiraRequest(`/project/${projectKey.trim()}`);
}

// Get issues from project
async function getIssuesList(projectKey, maxResults = 50) {
  if (!projectKey || !projectKey.trim()) {
    return { success: false, error: 'Project key is required' };
  }

  const jql = `project = ${projectKey.trim()} ORDER BY created ASC`;
  return await makeJiraRequest(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
}

// Get issue details
async function getIssue(issueKey) {
  if (!issueKey || !issueKey.trim()) {
    return { success: false, error: 'Issue key is required (e.g., BTS-1)' };
  }

  return await makeJiraRequest(`/issue/${issueKey.trim()}`);
}

// Create new issue
async function createIssue(projectKey, summary, description, issueType = 'Task') {
  if (!projectKey || !summary) {
    return { success: false, error: 'Project key and summary are required' };
  }

  // First, check if project exists
  const projectCheck = await getProject(projectKey);
  if (!projectCheck.success) {
    return { success: false, error: `Project '${projectKey}' not found or you don't have access to it. ${projectCheck.error}` };
  }

  const formattedDescription = formatDescriptionForJira(description);
  
  const issueData = {
    fields: {
      project: { key: projectKey },
      summary: summary,
      issuetype: { name: issueType }
    }
  };

  // Only add description if it's not empty
  if (formattedDescription) {
    issueData.fields.description = formattedDescription;
  }

  const response = await makeJiraRequest('/issue', {
    method: 'POST',
    body: issueData
  });
  return response;
}

// Delete issue
async function deleteIssue(issueKey) {
  if (!issueKey) {
    return { success: false, error: 'Issue key is required (e.g., BTS-1)' };
  }

  return await makeJiraRequest(`/issue/${issueKey}`, {
    method: 'DELETE'
  });
}

// =======================================
// USER INTERFACE FUNCTIONS
// =======================================

// ================================
// Manu Functions
// ================================
  
// Show setup menu for credentials
async function setupMenu(rl) {
    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
    
    while (true) {
      console.log('\n🔧 Jira Setup Menu');
      console.log('How would you like to configure your credentials?');
      console.log('1. 📁 Use .env file (if available)');
      console.log('2. ✏️  Enter credentials manually');
      console.log('='.repeat(40));
      
      const choice = await question('Please enter your choice (1 or 2): ');
      
      switch (choice.trim()) {
              case '1':
        const envSuccess = await useEnvCredentials();
        if (envSuccess) {
          console.log('\n✅ Credentials configured successfully!');
          return; // Exit setup menu and go to main menu
        }
        break;
        case '2':
          const success = await enterCredentialsManually(rl);
          if (success !== false && email && apiToken) {
            console.log('\n✅ Credentials configured successfully!');
            return; // Exit setup menu and go to main menu
          }
          break;
        default:
          console.log('❌ Invalid choice. Please enter 1 or 2.');
      }
    }
  }
  
  // Show welcome message with connection status
function showWelcomeMessage() {
      if (email && apiToken) {
        console.log('\n✅ Jira CLI Tool - Ready to use!');
        console.log(`📧 Connected as: ${email}`);
        console.log(`🌐 Jira URL: ${baseURL} (auto-generated from email)`);
      } else {
        console.log('\n🎯 Jira CLI Tool');
        console.log('⚠️  No credentials found. Please setup first.');
      }
  }
    
  // Show main menu with actions
async function mainMenu(rl) {
      const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
      
      while (true) {
        console.log('\nWhat would you like to do?');
        console.log('1. 🔍 Get an issue');
        console.log('2. ➕ Create an issue');
        console.log('3. 🗑️  Delete an issue');
        console.log('4. 🚪 Exit');
        console.log('='.repeat(30));
        
        const choice = await question('Please enter your choice (1, 2, 3, or 4): ');
    
        switch (choice.trim()) {
                  case '1':
          await selectAndDisplayIssue(rl);
          break;
          case '2':
            await createNewIssue(rl);
            break;
          case '3':
            await deleteSelectedIssue(rl);
            break;
          case '4':
            console.log('👋 Goodbye!');
            return;
          default:
            console.log('❌ Invalid choice. Please enter 1, 2, 3, or 4.');
        }
      }
  } 

// ================================
// Credentials Setup
// ================================
  

  // Load credentials from .env file
async function useEnvCredentials() {
  // Load environment variables from .env file
  dotenv.config();
  
  const envEmail = process.env.JIRA_EMAIL;
  const envToken = process.env.JIRA_API_TOKEN;
  
  if (envEmail && envToken) {
    // Set credentials from .env file (baseURL will be auto-generated from email)
    setCredentials(envEmail, envToken);
    
    // Test credentials from .env file first
    console.log('\n🔄 Testing credentials from .env file...');
    const isValid = await checkCredentials();
    if (!isValid) {
      console.log('❌ Credentials from .env file are not valid.');
      return false;
    }
    
    // Only show credentials info if they are valid
    console.log('\n✅ Using credentials from .env file!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 API Token: ${apiToken.substring(0, 10)}...`);
    console.log(`🌐 Base URL: ${baseURL} (auto-generated from email)`);
    return true;
  } else {
    console.log('\n❌ No credentials found in .env file.');
    console.log('💡 Tip: Please create a .env file with JIRA_EMAIL and JIRA_API_TOKEN');
    console.log('   Or choose option 2 to enter credentials manually.');
    return false;
  }
}
  
  // Enter credentials manually
async function enterCredentialsManually(rl) {
    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
    
    console.log('\n✏️  Manual Credentials Setup');
    console.log('You need your email and API token from: https://id.atlassian.com/manage-profile/security/api-tokens');
    
    const jiraEmail = await question('📧 Enter your email: ');
    const jiraToken = await question('🔑 Enter your API token: ');
    
    if (!jiraEmail.trim() || !jiraToken.trim()) {
      console.log('❌ Email and API token are required');
      return false;
    }
    
      // Set credentials and test them
  console.log('\n🔄 Testing credentials...');
  setCredentials(jiraEmail.trim(), jiraToken.trim());
  
  const isValid = await checkCredentials();
  if (isValid) {
    console.log('✅ Credentials set successfully!');
    return true;
  }
  
  return false;
  }

  // Test if credentials work
async function checkCredentials() {
  if (!email || !apiToken) {
    console.log('❌ Please setup credentials first');
    return false;
  }
  
  // Test credentials by trying to get current user
  const userResult = await getCurrentUser();
  if (!userResult.success) {
    console.log('❌ Credentials test failed:', userResult.error);
    console.log('💡 Tip: Please check your email and API token and try again.');
    return false;
  }
  
  // Check if user has access to any projects
  const projectsResult = await getProjectsList();
  if (!projectsResult.success) {
    console.log('❌ Error accessing projects:', projectsResult.error);
    console.log('💡 Tip: You may not have permission to access projects.');
    return false;
  }
  
  if (projectsResult.data.length === 0) {
    console.log('⚠️  User exists but no projects found.');
    console.log('💡 Tip: You may need to be added to a project or create one.');
    return false;
  }
  
  return true;
}
  

// ================================
// Actions on Project
// ================================
  
// Let user choose a project
async function selectProject(rl) {
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  try {
    console.log('\n🔍 Fetching available projects...');
    const projectsResult = await getProjectsList();
    
    if (!projectsResult.success) {
      console.log('❌ Error:', projectsResult.error);
      return null;
    }

    const projects = projectsResult.data;
    
    if (projects.length === 0) {
      console.log('📭 No projects found');
      return null;
    }

    console.log('\n📋 Available Projects:');
    console.log('='.repeat(40));
    
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.key} - ${project.name}`);
    });

    const projectChoice = await question(`\nPlease select a project (1-${projects.length}): `);
    const projectIndex = parseInt(projectChoice) - 1;
    
    if (isNaN(projectIndex) || projectIndex < 0 || projectIndex >= projects.length) {
      console.log('❌ Invalid project choice.');
      return null;
    }

    const selectedProject = projects[projectIndex];
    console.log(`\n✅ Selected project: ${selectedProject.key} - ${selectedProject.name}`);
    return selectedProject;
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

// Let user choose an issue from project
async function selectIssueFromProject(rl) {
  try {
    // Step 1: Select Project
    const selectedProject = await selectProject(rl);
    if (!selectedProject) return null;

    // Step 2: Fetch Issues
    console.log(`\n🔍 Fetching issues from project ${selectedProject.key}...`);
    const issuesResult = await getIssuesList(selectedProject.key);
    
    if (!issuesResult.success) {
      console.log('❌ Error:', issuesResult.error);
      return null;
    }

    // Step 3: Select Issue
    const selectedIssue = await selectIssueFromList(rl, issuesResult.data.issues, selectedProject.key);
    return selectedIssue;
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

// Choose and show an issue
async function selectAndDisplayIssue(rl) {
  const selectedIssue = await selectIssueFromProject(rl);
  if (selectedIssue) {
    await displayIssue(selectedIssue.key);
  }
}
  
// Let user pick an issue from list
async function selectIssueFromList(rl, issues, projectKey) {
    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
    
    if (issues.length === 0) {
      console.log(`📭 No issues found in project ${projectKey}`);
      return null;
    }
  
    console.log(`\n📋 Found ${issues.length} issue(s) in project ${projectKey}:`);
    console.log('='.repeat(60));
    
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.key} - ${issue.fields.summary}`);
    });
  
    const issueChoice = await question(`\nPlease select an issue (1-${issues.length}): `);
    const issueIndex = parseInt(issueChoice) - 1;
    
    if (isNaN(issueIndex) || issueIndex < 0 || issueIndex >= issues.length) {
      console.log('❌ Invalid issue choice.');
      return null;
    }
  
    return issues[issueIndex];
}

// Show issue details
async function displayIssue(issueKey) {
  try {
    console.log(`\n🔍 Fetching issue ${issueKey}...`);
    const result = await getIssue(issueKey);
    
    if (result.success) {
      const issue = result.data;
      console.log('✅ Issue Found:');
      console.log('🔑 Key:', issue.key);
      console.log('📝 Summary:', issue.fields.summary);
      console.log('📄 Description:', issue.fields.description || 'No description');
      console.log('👤 Assignee:', issue.fields.assignee?.displayName || 'Unassigned');
      console.log('📊 Status:', issue.fields.status.name);
      console.log('🏷️  Type:', issue.fields.issuetype.name);
    } else {
      console.log('❌ Error:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Create a new issue
async function createNewIssue(rl) {
  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
  
  try {
    // Step 1: Select Project
    const selectedProject = await selectProject(rl);
    if (!selectedProject) return;

    // Step 2: Enter Issue Details
    const summary = await question('\n📝 Enter issue summary: ');
    const description = await question('📄 Enter description (optional): ');
    
    if (!summary.trim()) {
      console.log('❌ Summary is required');
      return;
    }

    console.log('\n🔄 Creating issue...');
    const result = await createIssue(selectedProject.key, summary.trim(), description.trim());
    
    if (result.success) {
      console.log('✅ Issue created successfully!');
      console.log('🔑 New Issue Key:', result.data.key);
      console.log('🔗 URL:', `${baseURL}/browse/${result.data.key}`);
    } else {
      console.log('❌ Error:', result.error);
      console.log('💡 Tip: Make sure you have permission to create issues in this project.');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Delete an issue
async function deleteSelectedIssue(rl) {
  try {
    // Step 1-3: Select issue using shared function
    const selectedIssue = await selectIssueFromProject(rl);
    if (!selectedIssue) return;

    // Step 4: Confirm deletion
    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
    console.log(`\n⚠️  WARNING: You are about to delete issue ${selectedIssue.key}`);
    console.log(`📝 Summary: ${selectedIssue.fields.summary}`);
    console.log('🚨 This action cannot be undone!');
    
    const confirmation = await question('\nAre you sure you want to delete this issue? (yes/no): ');
    
    if (confirmation.toLowerCase() !== 'yes') {
      console.log('❌ Deletion cancelled.');
      return;
    }

    // Step 5: Delete the issue
    console.log(`\n🗑️  Deleting issue ${selectedIssue.key}...`);
    const result = await deleteIssue(selectedIssue.key);
    
    if (result.success) {
      console.log('✅ Issue deleted successfully!');
      console.log(`🗑️  Deleted: ${selectedIssue.key} - ${selectedIssue.fields.summary}`);
    } else {
      console.log('❌ Error:', result.error);
      console.log('💡 Tip: Make sure you have permission to delete issues in this project.');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}


// ================================
// MAIN FUNCTION
// ================================

// Start the application
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('\n🎯 Welcome to Jira CLI Tool!');
    
    // First, setup credentials
    await setupMenu(rl);
    
    // Then show main menu
    showWelcomeMessage();
    
    await mainMenu(rl);
  } finally {
    rl.close();
  }
}


// Start the application
main().catch(console.error);