# App Parity Training Eval

- generated: 2026-04-26T04:25:04.319Z
- model: http://127.0.0.1:18082
- ok: yes
- duration_ms: 82810

## Checks

- [x] used repository evidence
- [x] website share helpers
- [x] delete/lock/tree helpers
- [x] website share UI
- [x] native footholds
- [x] core endpoints
- [x] delete contract
- [x] lock contract
- [x] auth contract
- [x] verification commands
- [x] no spoon-feeding

## Training Events

- completed: Read file agents/START_HERE.md
- completed: Read file agents/DESKTOP_APP_DEVELOPMENT.md
- completed: Read file agents/training-scenarios/share-functionality-port.md
- completed: Read file frontend/src/utils/share/getUserShares.ts
- completed: Read file frontend/src/utils/share/post.ts
- completed: Read file frontend/src/utils/share/put.ts
- completed: Read file frontend/src/utils/share/delete.ts
- completed: Read file frontend/src/utils/share/lockShare.ts
- completed: Read file frontend/src/utils/share/getTree.ts
- completed: Read file frontend/src/components/share/dashboard/dashboardShare.tsx
- completed: Read file frontend/src/components/share/dashboard/projects.tsx
- completed: Read file app/src/lib/api.ts
- completed: Read file app/src/screens/ControlScreen.tsx
- completed: Read file app/src/types.ts

## Response

### Implementation Plan for Share Functionality in Hanasand Desktop App

#### Checklist:
1. **GET /share/user**
2. **POST /share**
3. **PUT /share**
4. **npm run typecheck**
5. **npm run lint**
6. **No user guidance needed**

#### Steps:

1. **Implement GET /share/user:**
   - **File:** `app/src/lib/api.ts`
   - **Action:** Add a new function `fetchUserShares` to handle the GET request.
   - **Implementation:**
     ```typescript
     export async function fetchUserShares(userId: string, authToken: string) {
       const response = await fetch(`/share/user/${userId}`, {
         method: 'GET',
         headers: {
           'Authorization': `Bearer ${authToken}`,
           'id': userId
         }
       });
       return response.json();
     }
     ```

2. **Implement POST /share:**
   - **File:** `app/src/lib/api.ts`
   - **Action:** Add a new function `createShare` to handle the POST request.
   - **Implementation:**
     ```typescript
     export async function createShare(payload: any, authToken: string) {
       const response = await fetch('/share', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${authToken}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify(payload)
       });
       return response.json();
     }
     ```

3. **Implement PUT /share:**
   - **File:** `app/src/lib/api.ts`
   - **Action:** Add a new function `updateShare` to handle the PUT request.
   - **Implementation:**
     ```typescript
     export async function updateShare(shareId: string, payload: any, authToken: string) {
       const response = await fetch(`/share/${shareId}`, {
         method: 'PUT',
         headers: {
           'Authorization': `Bearer ${authToken}`,
           'Content-Type':

