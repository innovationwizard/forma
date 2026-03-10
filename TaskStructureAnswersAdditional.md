Thank you for the comprehensive answers! I have a few clarifying questions to ensure I design the system perfectly:

## **Additional Questions**

### **1. Task Creation & Assignment**
- When an Admin creates a task, do they:
  - Set a **total target** (e.g., "Complete 100 linear meters of Sello de juntas")?
  - Set a **daily target** or just let workers work at their own pace?
  - Assign a **deadline** or completion date?

No target.
No deadline.

### **2. Progress Updates**
- When a worker logs progress, do they input:
  - **Amount completed** (e.g., "I completed 5 linear meters")?
  - **Amount worked on** (e.g., "I worked on 5 linear meters but only completed 3")?
  - **Both** (amount worked vs amount completed)?

Only amount completed.

### **3. Material Tracking Details**
- For each material in a task, do you need:
  - **Planned quantity** (how much should be used)?
  - **Actual consumption** (how much was actually used)?
  - **Loss quantity** (how much was wasted/lost)?
  - **Unit cost** for budget calculations?

No planned quantity.
No budget.
No cost. 
Only material consumption and material loss.

### **4. Task Assignment Workflow**
- When assigning a task to multiple workers:
  - Do they **share the same target** (e.g., 100 linear meters total)?
  - Do they get **individual targets** (e.g., 50 linear meters each)?
  - Can they **see each other's progress** on the same task?

Tasks assigned to multiple workers are shared. 
They share what they complete. 
They share what they can see.

### **5. Validation Process**
- When a Supervisor validates a progress update:
  - Can they **modify the reported amounts**?
  - Can they **reject and ask for correction**?
  - Do they need to **add comments** explaining their validation?

Supervisors have the three options: 
- Accept with comments
- Modify and accept
- Reject and ask for corrections

### **6. Additional Attributes Field**
- For the "additional attributes" field (like "room A" vs "room B"):
  - Should this be **free text** or **structured data**?
  - Should it be **searchable/filterable** in reports?
  - Should it be **required** or optional?

Free text, short, maybe 100 chars. 
Optional. 

### **7. Photo Integration**
- For the future photo feature:
  - Should photos be **attached to progress updates**?

Yes. "I did this and here's the photo to prove it."

  - Should photos be **required for validation**?

Photos are not required. 

  - Should photos be **stored locally** or in cloud storage?

We have Supabase Storage for this purpose. 

### **8. Productivity Calculation**
- For productivity metrics:
  - Is it **amount completed per hour worked**?

Correct. 

  - Do you need **daily/weekly/monthly productivity averages**?

Give Admin user and Supervisor users this choice. 

  - Should productivity be **compared against industry standards**?

No comparisson with business averages. 

These details will help me design the database schema and API endpoints to handle all the construction industry specifics correctly.