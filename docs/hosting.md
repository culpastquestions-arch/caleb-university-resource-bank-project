# Hosting Guide (School Platform)

This guide is a simple handover for hosting and long-term upkeep.

## What You Need

- Hosting that supports Node.js serverless endpoints (for /api/*).
- A domain name connected to the hosting platform.
- Access to a Google Drive folder that stores the past questions.
- Access to the Google Sheets that hold team data.

## One-Time Hosting Steps

1. Upload the full project to the hosting platform.
2. Set the required environment variables (see next section).
3. Build/start the app according to the host instructions (if required).
4. Set the domain name to point to the hosting platform.
5. Open the site and confirm:
   - Home page loads.
   - Departments list shows.
   - Team page shows executives and reps.

## Required Environment Variables

These are mandatory and must be set in the hosting platform:

- GOOGLE_DRIVE_API_KEY
- GOOGLE_DRIVE_ROOT_FOLDER_ID
- TEAM_SHEET_EXECUTIVES_URL
- TEAM_SHEET_REPS_URL

Tip: the values should be kept in a secure admin-only note.

## Domain Setup (Simple)

1. Buy or use the school domain.
2. In the domain DNS settings, point the domain to your hosting platform.
3. Wait for DNS to update (can take a few hours).
4. Enable HTTPS in the hosting platform if it is not automatic.

## Future Updates (Next 5 Years)

Most updates should be data-only and not require code changes.

### Update Team (Executives and Reps)

- Edit the Google Sheets.
- Keep the column names the same as the current template.
- Add a new session value when a new executive session starts.

### Update Past Questions

- Upload or organize files in Google Drive.
- Keep the folder structure consistent.
- Ensure folders and files are shared as "Anyone with the link".

### Update Environment Variables

Do this if any of the following change:

- New Google API key is issued.
- The Drive root folder changes.
- Team sheets are replaced with new ones.

Steps:
1. Update the value in the hosting platform.
2. Save and redeploy if required by the host.
3. Visit the site and refresh to confirm changes.

### Common Issues and Quick Fixes

- Team images not loading:
  - Confirm photos are public in Drive.
  - Check that the photo URL is valid in the sheet.

- Departments list is empty:
  - Confirm GOOGLE_DRIVE_ROOT_FOLDER_ID is correct.
  - Confirm the Drive folder is shared publicly.

- Team section is empty:
  - Confirm TEAM_SHEET_* URLs are published CSV links.

## If Hosting Platform Changes

If the school changes hosting providers:

1. Copy the full project to the new host.
2. Set the same environment variables.
3. Point the domain to the new host.
4. Test the site.
