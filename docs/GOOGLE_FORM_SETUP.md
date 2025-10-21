# Google Form Setup Guide

This guide will help you create and embed a Google Form for the CURB contact system.

## Overview

The contact form allows students to:
- Request missing files
- Report broken links
- Submit feedback
- Report technical issues

---

## Step 1: Create the Google Form

1. Go to [Google Forms](https://forms.google.com)
2. Click **"+ Blank"** or use a template
3. Give your form a title: **"CURB - Contact Form"**
4. Add a description:
   ```
   Have a question, found a broken link, or want to suggest new materials? 
   Let us know! We typically respond within 24-48 hours.
   ```

---

## Step 2: Add Form Fields

### Field 1: Name
- **Type:** Short answer
- **Label:** Your Name
- **Required:** Yes

### Field 2: Email
- **Type:** Short answer
- **Label:** Email Address
- **Required:** Yes
- **Validation:** Click ⋮ → **Response validation** → **Text** → **Email**

### Field 3: Department
- **Type:** Dropdown
- **Label:** Department
- **Required:** Yes
- **Options:** (Copy from list below)
  ```
  Accounting
  Architecture
  Biochemistry
  Business Administration
  Computer Science
  Criminology
  Cybersecurity
  Economics
  Human Anatomy
  Human Physiology
  Industrial Chemistry
  International Relations
  Jupeb
  Law
  Mass Communication
  Microbiology
  Nursing
  Political Science
  Psychology
  Software Engineering
  ```

### Field 4: Level
- **Type:** Multiple choice
- **Label:** Level (if applicable)
- **Required:** No
- **Options:**
  ```
  100 Level
  200 Level
  300 Level
  400 Level
  N/A
  ```

### Field 5: Request Type
- **Type:** Multiple choice
- **Label:** What can we help you with?
- **Required:** Yes
- **Options:**
  ```
  Missing Past Question/File
  Broken or Invalid Link
  Technical Issue
  Suggestion for Improvement
  Contributing Materials
  Other
  ```

### Field 6: Specific Course/File
- **Type:** Short answer
- **Label:** Specific Course or File (if applicable)
- **Required:** No
- **Description:** e.g., "ACC 202 - Financial Accounting II"

### Field 7: Details
- **Type:** Paragraph
- **Label:** Details
- **Required:** Yes
- **Description:** Please provide as much detail as possible

---

## Step 3: Configure Form Settings

1. Click the **⚙️ Settings** icon at the top

### General Tab:
- ✅ **Collect email addresses:** ON (recommended)
- ✅ **Limit to 1 response:** OFF
- ✅ **Edit after submit:** OFF
- ✅ **See summary charts and text responses:** ON

### Presentation Tab:
- ✅ **Show progress bar:** OFF (short form)
- ✅ **Shuffle question order:** OFF
- **Confirmation message:** 
  ```
  Thank you for contacting us! We've received your message and will respond 
  within 24-48 hours. Check your email for our response.
  ```

### Quizzes Tab:
- Leave OFF (this isn't a quiz)

---

## Step 4: Customize Form Appearance

1. Click the **🎨 Theme** icon at the top
2. **Color:** Choose green (#0F9D58 to match CURB)
3. **Background:** Solid color or keep default
4. **Font:** Choose a clean font (e.g., "Basic" or "Formal")

---

## Step 5: Get the Embed Code

1. Click **Send** button (top right)
2. Click the **< >** (Embed HTML) tab
3. You'll see code like:
   ```html
   <iframe src="https://docs.google.com/forms/d/e/FORM_ID/viewform?embedded=true" 
           width="640" 
           height="1000" 
           frameborder="0">
   </iframe>
   ```
4. **Copy this entire code**

---

## Step 6: Embed in Your Website

1. Open `index.html` in your code editor
2. Find the contact modal section (around line 170)
3. Look for this comment:
   ```html
   <!-- When ready, replace above with Google Form iframe: -->
   ```
4. Replace the placeholder content with your iframe:

### Before:
```html
<div class="contact-form-container">
  <!-- Placeholder content -->
  <div class="empty-state" style="padding: 2rem;">
    ...placeholder text...
  </div>
  
  <!-- When ready, replace above with Google Form iframe: -->
</div>
```

### After:
```html
<div class="contact-form-container">
  <iframe 
    src="https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform?embedded=true" 
    width="100%" 
    height="800" 
    frameborder="0" 
    marginheight="0" 
    marginwidth="0"
    style="border: none;">
    Loading…
  </iframe>
</div>
```

5. **Adjust the height** value (e.g., 800, 1000) based on your form length
6. Save the file
7. Commit and push to GitHub (if deployed)

---

## Step 7: Update Contact Information

In the same modal, update the alternative contact methods:

```html
<p><strong>Alternative Contact Methods:</strong></p>
<p class="footer-text">
  📧 Email: <a href="mailto:curb@calebuniversity.edu.ng">curb@calebuniversity.edu.ng</a><br>
  💬 WhatsApp: <a href="https://wa.me/2348012345678" target="_blank">+234 801 234 5678</a>
</p>
```

Replace with your actual email and WhatsApp number.

---

## Step 8: Set Up Response Collection

### View Responses:

1. In Google Forms, click the **Responses** tab
2. You'll see all submissions here

### Get Email Notifications:

1. Click the ⋮ (three dots) in the Responses tab
2. Click **Get email notifications for new responses**
3. You'll be notified whenever someone submits the form

### Link to Google Sheets:

1. In Responses tab, click the Sheets icon 📊
2. Click **Create a new spreadsheet**
3. All responses will be saved to this sheet
4. You can share this sheet with team members

---

## Step 9: Test the Form

1. Visit your website
2. Click **"Contact Us"**
3. Fill out and submit the form
4. Check that:
   - ✅ Submission goes through
   - ✅ You receive email notification
   - ✅ Response appears in Google Sheets
   - ✅ Form fits nicely in the modal

---

## Customization Tips

### Make Form Shorter:
- Combine fields (e.g., make level optional)
- Use conditional logic (show fields based on previous answers)

### Add Validation:
- For email: ⋮ → Response validation → Email
- For required fields: Toggle "Required" switch

### Multiple Language Support:
- Create separate forms for each language
- Add language selector in your modal

---

## Managing Responses

### Organize with Sheets:

In your Google Sheet, you can:
- Add a "Status" column (Pending, Resolved, etc.)
- Use filters to sort by type
- Create pivot tables for analytics
- Use conditional formatting for priorities

### Create Response Template:

Draft email templates for common requests:
```
Hi [Name],

Thank you for contacting CURB! 

[Response based on request type]

Best regards,
CURB Team
```

---

## Privacy & Data Protection

### Important Considerations:

1. **Inform users:** Add privacy notice to form description
   ```
   Privacy: Your information will only be used to respond to your inquiry 
   and will not be shared with third parties.
   ```

2. **Secure access:** 
   - Don't share the response sheet publicly
   - Only give access to trusted team members

3. **Data retention:**
   - Regularly archive old responses
   - Delete sensitive information when resolved

---

## Troubleshooting

### Form not displaying:
- Check iframe `src` URL is correct
- Verify form is set to "Anyone can respond"
- Check browser console for errors

### Form too small/large:
- Adjust `height` attribute in iframe
- Try values: 700, 800, 1000, 1200

### Not receiving notifications:
- Check Google Form settings
- Verify email notifications are enabled
- Check spam folder

### Responses not saving:
- Verify Google Sheets is linked
- Check you have edit access to the sheet

---

## Alternative: Use External Form Service

If you prefer not to use Google Forms, consider:

### Formspree
- [formspree.io](https://formspree.io)
- Sends submissions to your email
- Free tier: 50 submissions/month

### Form Submit
- [formsubmit.co](https://formsubmit.co)
- No registration needed
- Unlimited submissions (free)

### Typeform
- [typeform.com](https://typeform.com)
- Beautiful, conversational forms
- Free tier: 100 responses/month

---

## Best Practices

1. ✅ Respond within 24-48 hours
2. ✅ Set up auto-reply confirming receipt
3. ✅ Categorize and prioritize requests
4. ✅ Track resolution times
5. ✅ Use feedback to improve CURB
6. ✅ Thank contributors who submit materials

---

## Next Steps

- ✅ Form is set up and embedded
- Test thoroughly before announcing
- Create response workflow
- Assign team members to handle requests
- Monitor submissions regularly
- Use feedback to improve the platform

---

## Need Help?

**Google Forms Help:** [support.google.com/docs/topic/9055404](https://support.google.com/docs/topic/9055404)

**CURB Issues:** Check the GitHub repository issues page

