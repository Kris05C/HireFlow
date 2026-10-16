# HireFlow

HireFlow is a responsive recruitment management frontend built with React, Vite, Bootstrap 5, and React Router. It is a standalone demo: candidate and job information is fictional, campaign sending is simulated, and there is no backend, database, or email integration.

## Run locally

```sh
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm run lint` to check the source.

## Demo workspace

The app includes Dashboard, Jobs, Candidate discovery, Campaigns, Interested candidates, Follow-ups, and Settings routes. Jobs can be added and filtered; candidate discovery searches fictional profiles and explains its rule-based match score (70% listed-skill overlap, 20% role keyword match, and 10% location fit); campaigns can be previewed and saved or marked as simulated sends; follow-ups can be created and completed; and the profile can be updated.

User-created jobs, campaigns, interested-candidate statuses, follow-ups, and profile changes are stored in the browser's local storage. The included demo profiles contain no contact details. Campaign previews never send email.
