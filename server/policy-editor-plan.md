# TinyMCE Policy Editor — Full Implementation Guide
> MERN Stack · TypeScript (Frontend) · Self-Hosted TinyMCE (No API Key / No Load Limits)

---

## 1. Strategy: Self-Hosted vs Cloud

| Mode | API Key | Load Limit | Cost | Verdict |
|------|---------|------------|------|---------|
| Cloud (CDN) | Required | 1,000/month | Free tier | ❌ Hits limits fast |
| **Self-Hosted (npm)** | **None** | **Unlimited** | **$0 forever** | **✅ Use this** |

Install TinyMCE as an npm package and serve it from your own Vite bundle — no Tiny Cloud account, no branding watermark nags, no rate limits.

> ⚠️ **Branding note:** The GPL-2.0 license technically requires the "Powered by Tiny" footer when using the open-source build. For an internal compliance tool you're fine; for a customer-facing SaaS you may want to remove it via a commercial license later.

---

## 2. Free (Open-Source) Plugins — Use These ✅

These ship inside the `tinymce` npm package at zero cost:

| Plugin | Why include for a Policy Editor |
|--------|--------------------------------|
| `advlist` | Bullet/numbered list style options (legal numbering) |
| `anchor` | In-doc section anchors (link to §3.2 etc.) |
| `autolink` | Auto-convert URLs to links |
| `autoresize` | Editor grows with content, no fixed height |
| `autosave` | LocalStorage draft backup — pairs with your versioning |
| `charmap` | Insert special chars (©, §, ™, etc.) |
| `code` | View/edit raw HTML source |
| `codesample` | Fenced code blocks (useful in technical policies) |
| `fullscreen` | Distraction-free editing |
| `help` | Keyboard shortcut reference |
| `image` | Embed images (diagrams, org charts) |
| `importcss` | Inherit CSS classes for consistent policy styling |
| `insertdatetime` | Insert "Effective Date", "Review Date" stamps |
| `link` | Hyperlinks (external references, regulatory docs) |
| `lists` | Core list support (required for advlist) |
| `nonbreaking` | Non-breaking spaces — prevents text reflow in legal text |
| `pagebreak` | Print page breaks |
| `preview` | Full-page print preview |
| `quickbars` | Floating mini-toolbar on text selection (like Notion) |
| `searchreplace` | Find & replace within policy doc |
| `table` | Compliance matrix tables |
| `visualblocks` | Show block boundaries while editing |
| `wordcount` | Word/char count in status bar |
| `accordion` | Collapsible sections for long policies |

---

## 3. Premium Plugins — Skip for Now ❌

| Plugin | Why skip |
|--------|----------|
| `powerpaste` | Paste from Word cleanly — paid; use `paste` + sanitize instead |
| `tinymcespellchecker` | Spell check — paid; browser's native spell check works fine |
| `comments` / `tinycomments` | Inline comments — paid; build your own approval comments |
| `revisionhistory` | Version diff UI — paid; you already have versioning in MongoDB |
| `exportword` / `exportpdf` | Paid; implement server-side with `html-pdf` or `puppeteer` |
| `importword` | Paid; not critical for MVP |
| `a11ychecker` | Accessibility checker — paid |
| `ai` / `tinymce-ai` | AI writing — paid; add later with your own LLM |
| `mergetags` | Email merge fields — not relevant |

---

## 4. Package Installation

```bash
# Frontend
cd client
npm install tinymce @tinymce/tinymce-react
npm install --save-dev @types/tinymce
```

Then copy TinyMCE assets into your public folder (Vite approach):

```ts
// vite.config.ts — add this plugin to copy tinymce to public
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/tinymce',
          dest: 'libs',   // served at /libs/tinymce/tinymce.min.js
        },
      ],
    }),
  ],
})
```

```bash
npm install -D vite-plugin-static-copy
```

> Alternatively, just serve TinyMCE from `public/` by copying it manually once:
> `cp -r node_modules/tinymce public/tinymce`

---

## 5. Frontend: PolicyEditor Component

**`client/src/components/policy/PolicyEditor.tsx`**

```tsx
import { useRef, useCallback } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { Editor as TinyMCEEditor } from 'tinymce'

interface PolicyEditorProps {
  policyId: string
  policyTitle: string
  initialContent: string
  readOnly?: boolean
  onSave: (content: string) => Promise<void>
  onClose: () => void
  onSubmitForApproval?: () => void
  isSaving?: boolean
}

export function PolicyEditor({
  policyId,
  policyTitle,
  initialContent,
  readOnly = false,
  onSave,
  onClose,
  onSubmitForApproval,
  isSaving = false,
}: PolicyEditorProps) {
  const editorRef = useRef<TinyMCEEditor | null>(null)

  const handleSaveAndClose = useCallback(async () => {
    if (!editorRef.current) return
    const content = editorRef.current.getContent()
    await onSave(content)
    onClose()
  }, [onSave, onClose])

  const handleSave = useCallback(async () => {
    if (!editorRef.current) return
    const content = editorRef.current.getContent()
    await onSave(content)
  }, [onSave])

  return (
    <div className="flex flex-col h-full">
      {/* Header — matches Vanta's layout */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span
            className="hover:underline cursor-pointer"
            onClick={onClose}
          >
            Policies
          </span>
          <span>/</span>
          <span className="font-medium text-gray-900">{policyTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-save indicator is shown by TinyMCE's autosave plugin */}
          <button
            onClick={handleSaveAndClose}
            disabled={isSaving || readOnly}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 
                       bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save and close'}
          </button>
          {onSubmitForApproval && (
            <button
              onClick={onSubmitForApproval}
              disabled={readOnly}
              className="px-3 py-1.5 text-sm font-medium rounded-md 
                         bg-indigo-600 text-white hover:bg-indigo-700 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assign approver and submit
            </button>
          )}
        </div>
      </div>

      {/* TinyMCE Editor */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <Editor
          tinymceScriptSrc="/tinymce/tinymce.min.js"   // self-hosted — no API key
          onInit={(_evt, editor) => {
            editorRef.current = editor
          }}
          initialValue={initialContent}
          disabled={readOnly}
          init={editorConfig(policyId, handleSave)}
        />
      </div>
    </div>
  )
}

// ─── TinyMCE Configuration ───────────────────────────────────────────────────

function editorConfig(policyId: string, onAutoSave: () => void) {
  return {
    // Self-hosted — no CDN dependency
    base_url: '/tinymce',
    suffix: '.min',

    // All free/open-source plugins relevant to a policy editor
    plugins: [
      'accordion',
      'advlist',
      'anchor',
      'autolink',
      'autoresize',
      'autosave',
      'charmap',
      'code',
      'codesample',
      'fullscreen',
      'help',
      'image',
      'importcss',
      'insertdatetime',
      'link',
      'lists',
      'nonbreaking',
      'pagebreak',
      'preview',
      'quickbars',
      'searchreplace',
      'table',
      'visualblocks',
      'wordcount',
    ],

    // Toolbar — mirrors Vanta's toolbar order
    toolbar:
      'undo redo | ' +
      'blocks fontsize | ' +
      'bold italic underline strikethrough | ' +
      'forecolor backcolor | ' +
      'alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist outdent indent | ' +
      'link image table | ' +
      'searchreplace | ' +
      'fullscreen preview | ' +
      'charmap insertdatetime | ' +
      'code',

    toolbar_sticky: true,   // toolbar follows scroll — exactly like Vanta
    toolbar_sticky_offset: 0,

    menubar: 'edit view insert format tools table',

    // Auto-resize to content height (no fixed height box)
    autoresize_bottom_margin: 32,
    min_height: 500,

    // Autosave to localStorage — draft recovery
    autosave_ask_before_unload: true,
    autosave_interval: '30s',
    autosave_prefix: `policy-draft-${policyId}-`,
    autosave_restore_when_empty: false,
    autosave_retention: '2h',

    // Quick floating toolbar on text selection
    quickbars_selection_toolbar:
      'bold italic underline | link | formatselect',
    quickbars_insert_toolbar: false,   // cleaner — no + button on empty lines

    // Image handling — upload to your S3 via backend
    images_upload_url: `/api/policies/${policyId}/upload-image`,
    images_upload_credentials: true,
    images_reuse_filename: false,

    // Link plugin config
    link_default_target: '_blank',
    link_default_protocol: 'https',
    link_assume_external_targets: true,

    // Table defaults — clean policy tables
    table_default_attributes: {
      border: '1',
    },
    table_default_styles: {
      'border-collapse': 'collapse',
      width: '100%',
    },

    // Visual appearance
    skin: 'oxide',            // default clean skin (free)
    content_css: 'default',   // or point to your own CSS
    body_class: 'policy-content',

    // Content styling for the editable area
    content_style: `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.6;
        color: #111827;
        max-width: 860px;
        margin: 32px auto;
        padding: 0 32px;
      }
      h1 { font-size: 24px; font-weight: 700; margin-bottom: 16px; }
      h2 { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
      h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      td, th { border: 1px solid #e5e7eb; padding: 8px 12px; }
      th { background: #f9fafb; font-weight: 600; }
      blockquote {
        border-left: 3px solid #6366f1;
        margin: 16px 0;
        padding: 8px 16px;
        color: #6b7280;
      }
    `,

    // Word count in status bar
    wordcount_countcharacters: true,

    // Insert date/time formats for policy effective dates
    insertdatetime_formats: [
      '%Y-%m-%d',
      '%B %d, %Y',
      '%d %B %Y',
    ],

    // Branding — set false only with a commercial license
    // branding: false,

    // Resize handle
    resize: false,

    // On change — debounced auto-save hook
    setup: (editor: TinyMCEEditor) => {
      let saveTimer: ReturnType<typeof setTimeout>

      editor.on('input', () => {
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          onAutoSave()
        }, 3000) // debounce: 3s after last keystroke
      })
    },
  }
}
```

---

## 6. Page Route: Policy Editor Page

**`client/src/pages/policies/PolicyEditorPage.tsx`**

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PolicyEditor } from '@/components/policy/PolicyEditor'
import { getPolicyById, updatePolicyContent } from '@/api/policies'
import { toast } from 'sonner'

export function PolicyEditorPage() {
  const { policyId } = useParams<{ policyId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: policy, isLoading } = useQuery({
    queryKey: ['policy', policyId],
    queryFn: () => getPolicyById(policyId!),
  })

  const { mutateAsync: saveContent, isPending: isSaving } = useMutation({
    mutationFn: (content: string) =>
      updatePolicyContent(policyId!, content),
    onSuccess: () => {
      toast.success('Policy saved')
      queryClient.invalidateQueries({ queryKey: ['policy', policyId] })
    },
    onError: () => toast.error('Failed to save policy'),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading policy…</div>
  if (!policy) return <div className="p-8 text-center text-red-500">Policy not found</div>

  // Determine read-only: only allow edit in Draft or Needs Revision state
  const canEdit = ['draft', 'needs_revision'].includes(policy.status)

  return (
    <div className="h-screen flex flex-col bg-white">
      <PolicyEditor
        policyId={policyId!}
        policyTitle={policy.title}
        initialContent={policy.content ?? ''}
        readOnly={!canEdit}
        onSave={saveContent}
        onClose={() => navigate('/policies')}
        onSubmitForApproval={
          canEdit ? () => navigate(`/policies/${policyId}/submit`) : undefined
        }
        isSaving={isSaving}
      />
    </div>
  )
}
```

**Add to your router:**
```tsx
// In your router config
{ path: '/policies/:policyId/edit', element: <PolicyEditorPage /> }
```

---

## 7. API Layer (Frontend)

**`client/src/api/policies.ts`** — add these functions to your existing file:

```ts
import axios from '@/lib/axios'

// Get full policy doc (should already exist)
export const getPolicyById = async (policyId: string) => {
  const res = await axios.get(`/api/policies/${policyId}`)
  return res.data
}

// Save editor content — creates new version in backend
export const updatePolicyContent = async (
  policyId: string,
  content: string
) => {
  const res = await axios.patch(`/api/policies/${policyId}/content`, { content })
  return res.data
}

// Image upload for TinyMCE (handled automatically by images_upload_url)
// TinyMCE POSTs multipart form to this URL and expects { location: 'https://...' }
```

---

## 8. Backend: New Endpoints

### 8a. Save Policy Content (creates new version)

**`src/routes/policyRoutes.js`** — add:

```js
router.patch('/:policyId/content', protect, updatePolicyContent)
```

**`src/controllers/policyController.js`** — add:

```js
export const updatePolicyContent = async (req, res) => {
  try {
    const { policyId } = req.params
    const { content } = req.body
    const userId = req.user._id

    const policy = await Policy.findById(policyId)
    if (!policy) return res.status(404).json({ message: 'Policy not found' })

    // Only allow edit in draft/needs_revision states
    if (!['draft', 'needs_revision'].includes(policy.status)) {
      return res.status(403).json({ message: 'Policy is not editable in its current state' })
    }

    // Bump version on meaningful saves
    // Your existing version model — create a new PolicyVersion document
    const version = await PolicyVersion.create({
      policy: policyId,
      content,
      version: policy.currentVersion + 1,
      createdBy: userId,
      changelog: 'Auto-saved edit',
    })

    // Update policy current content + version pointer
    policy.content = content
    policy.currentVersion = version.version
    policy.updatedAt = new Date()
    await policy.save()

    res.json({ message: 'Saved', version: version.version })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
```

### 8b. Image Upload Endpoint

**`src/routes/policyRoutes.js`**:
```js
router.post('/:policyId/upload-image', protect, upload.single('file'), uploadPolicyImage)
```

**`src/controllers/policyController.js`**:
```js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuid } from 'uuid'

const s3 = new S3Client({ region: process.env.AWS_REGION })

export const uploadPolicyImage = async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file uploaded' })

    const key = `policy-images/${req.params.policyId}/${uuid()}-${file.originalname}`

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }))

    const location = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`

    // TinyMCE expects: { location: 'https://...' }
    res.json({ location })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
```

---

## 9. MongoDB: Policy Model Update

Add `content` field if not already present:

```js
// src/models/Policy.js — add to schema
const policySchema = new mongoose.Schema({
  // ... your existing fields ...
  content: {
    type: String,
    default: '',
  },
  currentVersion: {
    type: Number,
    default: 1,
  },
})
```

---

## 10. Read-Only Viewer (for Acknowledgement / Review)

For acknowledged users who should view but not edit:

```tsx
// client/src/components/policy/PolicyViewer.tsx
interface PolicyViewerProps {
  content: string
  title: string
}

export function PolicyViewer({ content, title }: PolicyViewerProps) {
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <div
        className="policy-content prose prose-sm max-w-none"
        // IMPORTANT: content is YOUR own users' HTML, sanitize if accepting 
        // external/untrusted input. For internal author content this is fine.
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  )
}
```

Install DOMPurify for sanitization as an extra safety layer:
```bash
npm install dompurify
npm install -D @types/dompurify
```

```tsx
import DOMPurify from 'dompurify'
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
```

---

## 11. Vite Configuration (complete)

**`vite.config.ts`**:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [{
        src: 'node_modules/tinymce',
        dest: 'libs',
      }],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Update `tinymceScriptSrc` in the Editor to `/libs/tinymce/tinymce.min.js`.

---

## 12. State Integration Summary

```
User clicks "Edit" on Policy list
        ↓
Navigate to /policies/:id/edit
        ↓
PolicyEditorPage fetches policy (React Query)
        ↓
PolicyEditor renders TinyMCE (self-hosted, no API key)
        ↓
User edits content
        ↓
Debounced auto-save (3s) → PATCH /api/policies/:id/content
        ↓
Backend creates new PolicyVersion document + updates policy.content
        ↓
"Assign approver and submit" → triggers your existing approval state machine
        ↓
Policy status → "pending_approval" (read-only in editor)
        ↓
Approver reviews in PolicyViewer (read-only)
        ↓
Approved → policy.status = "active"
        ↓
Active users see Acknowledgement prompt (existing module)
```

---

## 13. What You Get vs Vanta (Feature Parity)

| Vanta Feature | Your Implementation |
|--------------|---------------------|
| Sticky toolbar | `toolbar_sticky: true` ✅ |
| Paragraph/heading dropdown | `blocks` in toolbar ✅ |
| Font size | `fontsize` in toolbar ✅ |
| B / I / U / Strikethrough | Core + plugins ✅ |
| Text color / highlight | `forecolor backcolor` ✅ |
| Alignment | `alignleft…` ✅ |
| Lists (numbered + bullet) | `advlist` + `lists` ✅ |
| Outdent / Indent | Core ✅ |
| Tables | `table` plugin ✅ |
| Links | `link` plugin ✅ |
| Search | `searchreplace` ✅ |
| Full screen | `fullscreen` ✅ |
| Auto-save indicator | `autosave` plugin shows indicator ✅ |
| Save and close button | Custom header ✅ |
| Assign approver & submit | Connects to your existing approval flow ✅ |
| Versioning | Your existing PolicyVersion model ✅ |
| Read-only for non-editors | `readOnly` prop + status check ✅ |
| Image upload | S3 via `images_upload_url` ✅ |

---

## 14. Codex Prompts

### Step 0 — Research & Review First (Run This Before Anything Else)

**Paste this as your very first Codex message before any implementation:**

> Before writing a single line of code, I need you to research and review our existing codebase thoroughly. Do not implement anything yet.
>
> **Explore the following and report back:**
>
> 1. **Policy module — frontend**
>    - Find all files under `client/src/` related to policies: pages, components, hooks, API calls, types/interfaces, Zustand stores, React Query keys.
>    - Identify: how is a Policy object typed? What fields does it currently have (`title`, `status`, `content`, `versions`…)?
>    - Find the existing policy list page and any existing policy detail/view page. What routes are registered in the router?
>    - Check if `content` field already exists on the Policy type or if it needs to be added.
>
> 2. **Policy module — backend**
>    - Find `src/models/Policy.js` and `src/models/PolicyVersion.js` (or equivalent). List every field on each schema.
>    - Find `src/routes/policyRoutes.js` and list every existing route (method + path).
>    - Find `src/controllers/policyController.js` and list existing controller functions.
>    - Check how `multer` is currently configured — is there a shared upload middleware or does it need to be created?
>    - Check how S3 uploads are done elsewhere in the codebase — is there a shared S3 helper/service I should reuse?
>    - Identify the auth middleware name and import path used to protect routes (e.g. `protect`, `authMiddleware`).
>
> 3. **State machine / status field**
>    - What are the exact string values used for `policy.status`? (e.g. `'draft'`, `'pending_approval'`, `'active'`, `'needs_revision'` — confirm the exact values in use)
>    - Is there an existing status transition guard or state machine utility I should plug into?
>
> 4. **Frontend infrastructure**
>    - Confirm the axios instance location and base URL config (`client/src/lib/axios.ts` or similar).
>    - Confirm the React Query setup — where are query keys defined, is there a centralized `queryKeys` object?
>    - Check `vite.config.ts` — is `vite-plugin-static-copy` already installed or do I need to add it?
>    - Check if `dompurify` is already installed.
>    - Confirm the path alias `@` is set up and points to `client/src/`.
>
> 5. **Routing**
>    - Find the main router file. What is the exact pattern for adding a new protected route? Is there a layout wrapper I need to use?
>
> **After your research, produce a short review report:**
> - List any conflicts between this implementation plan and the actual codebase (e.g. field names that differ, middleware that is named differently, models that already have `content`, routes that already exist).
> - List anything in the plan that needs to be adjusted to fit the existing patterns.
> - List any files you'll need to create vs. modify.
> - Confirm the exact status string values to use in the `canEdit` check.
>
> Only after I approve your report should you begin implementation.

---

### Step 1 — Vite Config & Package Install (after review approved)

> Based on your research findings, set up TinyMCE as self-hosted:
> 1. Install `tinymce` and `@tinymce/tinymce-react` in `client/`.
> 2. Install `dompurify` and `@types/dompurify` if not already present.
> 3. Update `vite.config.ts` to copy TinyMCE assets to public using `vite-plugin-static-copy` (install it if needed). Target: copy `node_modules/tinymce` → `dist/libs/tinymce` so TinyMCE is served at `/libs/tinymce/tinymce.min.js`.
> 4. Do not add an API key anywhere — we are fully self-hosted.
> Confirm the config works by checking the build output.

---

### Step 2 — Frontend: PolicyEditor Component

> Create `client/src/components/policy/PolicyEditor.tsx` — a self-contained TinyMCE editor component.
> Use the exact Policy type fields you found during research. Props: `policyId: string`, `policyTitle: string`, `initialContent: string`, `readOnly: boolean`, `onSave: (content: string) => Promise<void>`, `onClose: () => void`, `onSubmitForApproval?: () => void`, `isSaving: boolean`.
> - Self-hosted: `tinymceScriptSrc='/libs/tinymce/tinymce.min.js'`
> - Free plugins only: advlist, anchor, autolink, autoresize, autosave, charmap, code, codesample, fullscreen, help, image, insertdatetime, link, lists, nonbreaking, pagebreak, preview, quickbars, searchreplace, table, visualblocks, wordcount
> - `autosave_prefix` must include the policyId to avoid cross-policy draft collisions
> - `images_upload_url` should point to `/api/policies/${policyId}/upload-image`
> - Toolbar sticky, debounced auto-save on input (3s)
> - Header bar (outside TinyMCE): breadcrumb "Policies / {title}", "Save and close" button, "Assign approver and submit" button — matching Vanta's layout from the screenshot
> - Match the path alias convention you found during research

---

### Step 3 — Frontend: PolicyEditorPage

> Create `client/src/pages/policies/PolicyEditorPage.tsx`.
> - Use the React Query pattern you found during research (match existing query key conventions).
> - Fetch the policy by ID using the existing `getPolicyById` API function (or the equivalent you found).
> - Add `updatePolicyContent` to the existing API file — PATCH to `/api/policies/:policyId/content` with `{ content }`.
> - `canEdit` check must use the exact status string values confirmed during research.
> - Register the route in the router using the exact layout wrapper and auth guard pattern used by other policy routes.

---

### Step 4 — Backend: Content Save Endpoint

> Add to the policy routes and controller — based on the patterns you found during research:
> - Route: `PATCH /api/policies/:policyId/content` — protected by the auth middleware you identified.
> - Controller: validate `policy.status` against the confirmed editable status values, create a new `PolicyVersion` document (use the exact schema fields you found), update `policy.content` and version pointer, return `{ message: 'Saved', version: <number> }`.
> - Reuse any existing versioning helper if one exists.

---

### Step 5 — Backend: Image Upload Endpoint

> Add image upload to the policy routes — based on your research findings:
> - Route: `POST /api/policies/:policyId/upload-image` — protected.
> - Reuse the existing S3 helper/service you found. If none exists, create one at `src/services/s3Service.js`.
> - Reuse or extend the existing multer config. Accept `image/*` only, max 5MB.
> - Response must be `{ location: 'https://…' }` exactly — TinyMCE requires this format.

---

### Step 6 — Read-Only Viewer

> Create `client/src/components/policy/PolicyViewer.tsx`.
> - Renders policy HTML content with `dangerouslySetInnerHTML` wrapped in DOMPurify sanitize.
> - Apply the same `content_style` CSS as the editor so the rendered output looks identical to the editing view.
> - Use this component wherever a policy is currently displayed for reading (acknowledgement flow, approval review) — find those locations during implementation and swap them in.