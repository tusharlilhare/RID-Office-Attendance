
Office Attendance (Demo) - with Signup/Login + Project Manager Admin
------------------------------------------------------------------
Features added:
- Signup (name, role, password). Unique name required.
- Login (name + password).
- JWT token-based auth stored in localStorage by frontend and sent in Authorization header.
- Project Manager role can view all attendance, delete attendance, create/delete users.
- Protected API endpoints require token.

Run:
1. npm install
2. npm start
3. Open http://localhost:4000
Notes:
- Replace JWT_SECRET in .env for production.
- This is still a demo; for production improve security (rate-limiting, strong passwords, HTTPS).
