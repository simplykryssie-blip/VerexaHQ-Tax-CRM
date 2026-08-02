-- Seeds the editable Verexa tax workflow plus reusable public-lead and pricing
-- assessment templates. Firm copies can replace these defaults without changing
-- active engagements because each engagement stores an immutable snapshot.

begin;

do $$
declare
  v_workflow_template_id uuid;
  v_workflow_version_id uuid;
  v_definition_id uuid;
  v_lead_template_id uuid;
  v_lead_version_id uuid;
  v_pricing_template_id uuid;
  v_pricing_version_id uuid;
begin
  select id into v_workflow_template_id
  from public.templates
  where workspace_id is null and is_system_template and kind='workflow'
    and metadata->>'system_key'='verexa_tax_preparation_v1'
  limit 1;

  if v_workflow_template_id is null then
    insert into public.templates(
      kind,name,description,category,visibility,status,is_system_template,is_required,
      allow_workspace_customization,metadata,published_at
    ) values(
      'workflow','Verexa Default Tax Preparation Workflow',
      'End-to-end tax preparation workflow from engagement setup through filing acceptance and archive.',
      'Tax Preparation','marketplace','published',true,false,true,
      jsonb_build_object('system_key','verexa_tax_preparation_v1','intended_use','tax_preparation'),now()
    ) returning id into v_workflow_template_id;
  end if;

  select id into v_workflow_version_id from public.template_versions
  where template_id=v_workflow_template_id and version_number=1;
  if v_workflow_version_id is null then
    insert into public.template_versions(
      template_id,version_number,status,name,description,change_summary,schema_version,content,published_at
    ) values(
      v_workflow_template_id,1,'published','Verexa Default Tax Preparation Workflow',
      'The standard Verexa tax production workflow. Duplicate it before firm customization.',
      'Initial Verexa workflow',1,
      jsonb_build_object(
        'phases',jsonb_build_array('Setup','Client onboarding','Preparation','Review','Client approval','Filing','Completion'),
        'separate_trackers',jsonb_build_array('intake','documents','engagement_letter','payment','signature','extension','filing','review')
      ),now()
    ) returning id into v_workflow_version_id;
    update public.templates set current_version_id=v_workflow_version_id,
      latest_published_version_id=v_workflow_version_id where id=v_workflow_template_id;
  end if;

  select id into v_definition_id from public.workflow_definitions
  where template_version_id=v_workflow_version_id;
  if v_definition_id is null then
    insert into public.workflow_definitions(
      template_id,template_version_id,workspace_id,name,description,trigger_type,
      trigger_config,is_active,allow_manual_start,settings
    ) values(
      v_workflow_template_id,v_workflow_version_id,null,'Verexa Default Tax Preparation Workflow',
      'Primary tax preparation workflow automatically copied to new tax engagements.',
      'engagement_created','{}'::jsonb,true,true,
      jsonb_build_object('system_key','verexa_tax_preparation_v1','workflow_mode','human_pipeline')
    ) returning id into v_definition_id;
  end if;

  if not exists(select 1 from public.workflow_nodes where workflow_definition_id=v_definition_id) then
    with inserted as (
      insert into public.workflow_nodes(workflow_definition_id,node_key,node_type,label,position_x,position_y,config)
      values
        (v_definition_id,'start','start','Engagement created',0,0,'{}'),
        (v_definition_id,'end','end','Engagement archived',400,0,'{}')
      returning id,node_key
    )
    insert into public.workflow_connections(workflow_definition_id,source_node_id,target_node_id,label)
    select v_definition_id,s.id,e.id,'Human workflow stages'
    from inserted s cross join inserted e where s.node_key='start' and e.node_key='end';
  end if;

  if not exists(select 1 from public.workflow_stages where workflow_definition_id=v_definition_id) then
    insert into public.workflow_stages(
      workflow_definition_id,stage_key,label,phase,description,sort_order,stage_kind,
      engagement_status,entry_actions,exit_requirements,default_assignee_role,
      client_visible_label,is_client_visible,is_locked
    ) values
      (v_definition_id,'draft_engagement','Draft Engagement','Setup','Engagement details are being prepared; nothing is sent to the client.',10,'standard','draft','[]','[]','preparer','Engagement setup',false,true),
      (v_definition_id,'awaiting_activation','Awaiting Activation','Setup','Staff must choose draft, activate only, or activate and send.',20,'standard','draft','[]','[]','preparer','Engagement setup',false,true),
      (v_definition_id,'activated','Activated','Setup','The engagement is active.',30,'standard','intake_not_started','[]','[]','preparer','Engagement opened',true,true),
      (v_definition_id,'intake_documents_requested','Intake & Documents Requested','Client onboarding','Portal invitation, organizer, and initial document list are available.',40,'standard','documents_requested','[{"action":"send_portal_invite_if_needed"},{"action":"send_intake"},{"action":"send_document_request"}]','[]','intake_specialist','Information requested',true,true),
      (v_definition_id,'client_intake_in_progress','Client Intake in Progress','Client onboarding','The client opened or started the organizer.',50,'standard','intake_in_progress','[]','[]','intake_specialist','Organizer in progress',true,false),
      (v_definition_id,'waiting_on_client','Waiting on Client','Client onboarding','Staff is waiting for organizer answers, documents, or a response.',60,'standard','awaiting_client','[{"action":"schedule_reminders"}]','[]','intake_specialist','Waiting for your information',true,false),
      (v_definition_id,'intake_submitted','Intake Submitted','Client onboarding','The client submitted the organizer.',70,'standard','intake_in_progress','[{"action":"notify_assigned_staff"}]','[{"tracker":"intake","status":"submitted"}]','intake_specialist','Organizer received',true,false),
      (v_definition_id,'compliance_review','Compliance Review','Client onboarding','Staff reviews completeness, identity, compliance answers, and uploaded documents.',80,'standard','intake_in_progress','[{"action":"create_staff_task","task":"Review organizer and documents"}]','[]','intake_specialist','Information under review',true,true),
      (v_definition_id,'missing_information_requested','Missing Information Requested','Client onboarding','The client has specific missing items or clarification requests.',90,'standard','missing_documents','[{"action":"send_missing_information_request"},{"action":"schedule_reminders"}]','[]','intake_specialist','Additional information requested',true,false),
      (v_definition_id,'ready_for_preparation','Ready for Preparation','Client onboarding','Minimum intake and document requirements are satisfied.',100,'standard','ready_for_preparation','[{"action":"notify_preparer"}]','[{"tracker":"intake","status":"reviewed"}]','preparer','Ready for preparation',true,true),
      (v_definition_id,'assigned_for_preparation','Assigned for Preparation','Preparation','A preparer owns the engagement.',110,'standard','ready_for_preparation','[{"action":"assign_preparer"}]','[{"field":"primary_preparer_user_id","required":true}]','preparer','Assigned for preparation',true,false),
      (v_definition_id,'in_preparation','In Preparation','Preparation','The return is being prepared in external tax software.',120,'standard','in_preparation','[]','[]','preparer','In preparation',true,true),
      (v_definition_id,'preparation_questions_pending','Preparation Questions Pending','Preparation','Preparation is paused for answers or documents.',130,'standard','awaiting_client','[{"action":"notify_client"}]','[]','preparer','Questions pending',true,false),
      (v_definition_id,'preparation_complete','Preparation Complete','Preparation','The preparer completed the return and supporting workpapers.',140,'standard','preparer_review','[]','[{"field":"primary_preparer_user_id","required":true}]','preparer','Preparation complete',true,true),
      (v_definition_id,'awaiting_reviewer','Awaiting Reviewer','Review','The return is queued for reviewer assignment or review.',150,'standard','reviewer_review','[{"action":"assign_reviewer_from_policy"}]','[]','reviewer','Awaiting review',true,true),
      (v_definition_id,'under_review','Under Review','Review','The assigned reviewer is reviewing the return.',160,'standard','reviewer_review','[]','[]','reviewer','Under review',true,true),
      (v_definition_id,'corrections_required','Corrections Required','Review','The reviewer returned the engagement with required corrections.',170,'standard','in_preparation','[{"action":"notify_preparer"}]','[]','preparer','Corrections in progress',true,true),
      (v_definition_id,'approved_by_reviewer','Approved by Reviewer','Review','Review is complete. Standalone PTIN engagements may bypass this stage when review is not required.',180,'standard','ready_to_file','[]','[{"tracker":"review","status":"approved","unless":"review_not_required"}]','reviewer','Review approved',true,true),
      (v_definition_id,'return_ready_client_review','Return Ready for Client Review','Client approval','The client can review the return summary.',190,'standard','awaiting_signature','[{"action":"notify_client"}]','[]','preparer','Return ready for your review',true,true),
      (v_definition_id,'awaiting_client_signature','Awaiting Client Signature','Client approval','Required e-file authorization or engagement signatures are outstanding.',200,'standard','awaiting_signature','[{"action":"request_signature"},{"action":"schedule_reminders"}]','[]','preparer','Awaiting signature',true,true),
      (v_definition_id,'awaiting_payment','Awaiting Payment','Client approval','Required payment is outstanding.',210,'standard','awaiting_payment','[{"action":"request_payment"},{"action":"schedule_reminders"}]','[]','billing','Awaiting payment',true,true),
      (v_definition_id,'ready_to_file','Ready to File','Client approval','All filing gates required by the firm are satisfied.',220,'standard','ready_to_file','[]','[{"tracker":"signature","status":"complete"},{"tracker":"payment","status":"paid_or_waived"}]','preparer','Ready to file',true,true),
      (v_definition_id,'submitted_for_filing','Submitted for Filing','Filing','Staff submitted the return through external tax software.',230,'standard','transmitted_externally','[{"action":"record_external_submission"}]','[]','preparer','Submitted for filing',true,true),
      (v_definition_id,'awaiting_acknowledgment','Awaiting Acknowledgment','Filing','Waiting for the external transmitter acknowledgment.',240,'standard','acknowledgement_pending','[]','[]','preparer','Awaiting acknowledgment',true,false),
      (v_definition_id,'accepted','Accepted','Filing','The taxing authority accepted the return.',250,'standard','accepted','[{"action":"notify_client"}]','[{"tracker":"filing","status":"accepted"}]','preparer','Return accepted',true,true),
      (v_definition_id,'rejected','Rejected','Filing','The external acknowledgment shows a rejection.',260,'standard','rejected','[{"action":"notify_preparer"},{"action":"create_staff_task","task":"Correct filing rejection"}]','[]','preparer','Filing correction needed',true,true),
      (v_definition_id,'rejection_correction','Rejection Correction in Progress','Filing','Staff is correcting the rejected return.',270,'standard','correction_in_progress','[]','[]','preparer','Filing correction in progress',true,false),
      (v_definition_id,'resubmitted','Resubmitted','Filing','The corrected return was resubmitted externally.',280,'standard','transmitted_externally','[{"action":"record_external_submission"}]','[]','preparer','Return resubmitted',true,false),
      (v_definition_id,'completed','Completed','Completion','The engagement work is complete.',290,'terminal','completed','[{"action":"notify_client"}]','[]','preparer','Completed',true,true),
      (v_definition_id,'archived','Archived','Completion','The engagement is retained as a closed historical record.',300,'terminal','archived','[]','[]','admin','Archived',false,true),
      (v_definition_id,'on_hold','On Hold','Exception','Work is temporarily paused.',900,'exception','on_hold','[]','[]','preparer','On hold',true,false),
      (v_definition_id,'extended','Extended','Exception','An extension was filed; the original payment deadline remains in effect.',910,'exception','extended','[{"action":"activate_extended_deadline"}]','[]','preparer','Extension filed',true,true),
      (v_definition_id,'client_withdrew','Client Withdrew','Exception','The client withdrew before completion.',920,'exception','cancelled','[]','[{"reason":"required"}]','admin','Engagement closed',true,false),
      (v_definition_id,'firm_disengaged','Firm Disengaged','Exception','The firm ended the engagement.',930,'exception','cancelled','[{"action":"generate_disengagement_notice"}]','[{"reason":"required"}]','admin','Engagement closed',true,true),
      (v_definition_id,'cancelled','Cancelled','Exception','The engagement was cancelled.',940,'exception','cancelled','[]','[{"reason":"required"}]','admin','Cancelled',true,false),
      (v_definition_id,'amended_return_required','Amended Return Required','Exception','A separate amended-return engagement should be created and linked.',950,'exception','completed','[{"action":"suggest_new_engagement","engagement_type":"amended_return"}]','[]','preparer','Follow-up return required',true,false);

    insert into public.workflow_stage_transitions(
      workflow_definition_id,from_stage_id,to_stage_id,label,transition_kind,requires_reason,sort_order
    )
    select v_definition_id,a.id,b.id,'Continue','normal',false,a.sort_order
    from public.workflow_stages a join public.workflow_stages b
      on b.workflow_definition_id=a.workflow_definition_id and b.sort_order=a.sort_order+10
    where a.workflow_definition_id=v_definition_id and a.sort_order between 10 and 290
      and a.stage_key not in (
        'under_review','corrections_required','awaiting_acknowledgment','accepted',
        'rejected','rejection_correction','resubmitted','completed'
      );

    insert into public.workflow_stage_transitions(workflow_definition_id,from_stage_id,to_stage_id,label,transition_kind,requires_reason,sort_order)
    select v_definition_id,a.id,b.id,x.label,x.kind,x.reason,x.ord
    from (values
      ('under_review','approved_by_reviewer','Approve','normal',false,1),
      ('under_review','corrections_required','Return for corrections','correction',true,2),
      ('corrections_required','in_preparation','Correct return','correction',false,1),
      ('preparation_complete','return_ready_client_review','Skip review when not required','normal',true,2),
      ('awaiting_acknowledgment','accepted','Accepted','normal',false,1),
      ('awaiting_acknowledgment','rejected','Rejected','correction',false,2),
      ('rejected','rejection_correction','Correct rejection','correction',false,1),
      ('rejection_correction','resubmitted','Resubmit','correction',false,1),
      ('resubmitted','awaiting_acknowledgment','Await new acknowledgment','normal',false,1),
      ('accepted','completed','Complete engagement','normal',false,1),
      ('completed','archived','Archive','normal',false,1)
    ) x(from_key,to_key,label,kind,reason,ord)
    join public.workflow_stages a on a.workflow_definition_id=v_definition_id and a.stage_key=x.from_key
    join public.workflow_stages b on b.workflow_definition_id=v_definition_id and b.stage_key=x.to_key;
  end if;

  -- Reusable lead form template. It deliberately excludes SSN/ITIN/EIN,
  -- banking details, and document uploads.
  select id into v_lead_template_id from public.templates
  where workspace_id is null and is_system_template and kind='form'
    and metadata->>'system_key'='verexa_tax_lead_form_v1' limit 1;
  if v_lead_template_id is null then
    insert into public.templates(kind,name,description,category,visibility,status,is_system_template,allow_workspace_customization,metadata,published_at)
    values('form','New Tax Client Lead Form','Public, non-sensitive lead capture form.','Lead Forms','marketplace','published',true,true,
      jsonb_build_object('system_key','verexa_tax_lead_form_v1','intended_use','lead_form','public_safe',true),now())
    returning id into v_lead_template_id;
  end if;
  select id into v_lead_version_id from public.template_versions where template_id=v_lead_template_id and version_number=1;
  if v_lead_version_id is null then
    insert into public.template_versions(template_id,version_number,status,name,schema_version,content,published_at)
    values(v_lead_template_id,1,'published','New Tax Client Lead Form',1,
      jsonb_build_object('sections',jsonb_build_array(
        jsonb_build_object('title','Contact information','fields',jsonb_build_array(
          jsonb_build_object('key','first_name','label','First name','type','text','required',true),
          jsonb_build_object('key','last_name','label','Last name','type','text','required',true),
          jsonb_build_object('key','email','label','Email','type','email'),
          jsonb_build_object('key','phone','label','Phone','type','phone'),
          jsonb_build_object('key','preferred_contact_method','label','Preferred contact method','type','select','options',jsonb_build_array('Email','Phone','Text'))
        )),
        jsonb_build_object('title','Services requested','fields',jsonb_build_array(
          jsonb_build_object('key','client_kind','label','Are you seeking help for an individual or business?','type','select','options',jsonb_build_array('Individual','Business','Both'),'required',true),
          jsonb_build_object('key','services','label','Services needed','type','multi_select','options',jsonb_build_array('Individual tax return','Business tax return','Amended return','Prior-year return','Tax planning','Other'),'required',true),
          jsonb_build_object('key','tax_years','label','Tax years needed','type','multi_select'),
          jsonb_build_object('key','states','label','States involved','type','multi_select'),
          jsonb_build_object('key','description','label','Briefly describe what you need','type','textarea')
        )),
        jsonb_build_object('title','Referral','fields',jsonb_build_array(
          jsonb_build_object('key','referral_source','label','How did you hear about us?','type','select')
        ))
      )),now()) returning id into v_lead_version_id;
    update public.templates set current_version_id=v_lead_version_id,latest_published_version_id=v_lead_version_id where id=v_lead_template_id;
  end if;

  select id into v_pricing_template_id from public.templates
  where workspace_id is null and is_system_template and kind='form'
    and metadata->>'system_key'='verexa_tax_pricing_assessment_v1' limit 1;
  if v_pricing_template_id is null then
    insert into public.templates(kind,name,description,category,visibility,status,is_system_template,allow_workspace_customization,metadata,published_at)
    values('form','Tax Preparation Pricing Assessment','Short assessment used to quote before the full organizer.','Pricing Assessments','marketplace','published',true,true,
      jsonb_build_object('system_key','verexa_tax_pricing_assessment_v1','intended_use','pricing_assessment'),now())
    returning id into v_pricing_template_id;
  end if;
  select id into v_pricing_version_id from public.template_versions where template_id=v_pricing_template_id and version_number=1;
  if v_pricing_version_id is null then
    insert into public.template_versions(template_id,version_number,status,name,schema_version,content,published_at)
    values(v_pricing_template_id,1,'published','Tax Preparation Pricing Assessment',1,
      jsonb_build_object('fields',jsonb_build_array(
        jsonb_build_object('key','filing_status','label','Expected filing status','type','select'),
        jsonb_build_object('key','tax_years','label','Tax years','type','multi_select','required',true),
        jsonb_build_object('key','states','label','State returns needed','type','multi_select'),
        jsonb_build_object('key','w2_count','label','Number of W-2s','type','number'),
        jsonb_build_object('key','dependent_count','label','Number of dependents','type','number'),
        jsonb_build_object('key','has_self_employment','label','Self-employment or 1099 income?','type','yes_no'),
        jsonb_build_object('key','rental_count','label','Number of rental properties','type','number'),
        jsonb_build_object('key','has_investments_crypto','label','Investments or cryptocurrency?','type','yes_no'),
        jsonb_build_object('key','business_entity_count','label','Businesses owned','type','number'),
        jsonb_build_object('key','is_prior_or_amended','label','Prior-year or amended return?','type','yes_no'),
        jsonb_build_object('key','needs_bookkeeping_cleanup','label','Bookkeeping cleanup needed?','type','yes_no'),
        jsonb_build_object('key','special_circumstances','label','Other special circumstances','type','textarea')
      )),now()) returning id into v_pricing_version_id;
    update public.templates set current_version_id=v_pricing_version_id,latest_published_version_id=v_pricing_version_id where id=v_pricing_template_id;
  end if;

  -- Every current firm gets a tax-preparation default. A firm can later point
  -- each row to its own published workflow/template versions.
  insert into public.engagement_type_settings(
    workspace_id,engagement_type,return_type,name,primary_workflow_definition_id,
    organizer_template_id,organizer_template_version_id,pricing_method,reviewer_policy
  )
  select w.id,x.engagement_type::public.engagement_type,x.return_type::public.tax_return_type,x.name,v_definition_id,
    o.id,o.latest_published_version_id,'staff_entered','auto_ero'
  from public.workspaces w
  cross join (values
    ('individual_return','1040','Individual Tax Preparation'),
    ('business_return','1065','Partnership Tax Preparation'),
    ('business_return','1120','C Corporation Tax Preparation'),
    ('business_return','1120-S','S Corporation Tax Preparation'),
    ('business_return','990','Nonprofit Tax Preparation'),
    ('amended_return','1040-X','Amended Individual Return')
  ) x(engagement_type,return_type,name)
  left join lateral (
    select t.id,t.latest_published_version_id from public.templates t
    where t.kind='form' and t.status='published' and t.metadata->>'tax_form'=x.return_type
      and t.metadata->>'intended_use'='tax_organizer'
    order by t.is_system_template desc,t.created_at limit 1
  ) o on true
  where w.workspace_type<>'platform_admin'
  on conflict (workspace_id,engagement_type,return_type) do nothing;

  insert into public.lead_forms(
    workspace_id,template_id,published_version_id,name,public_slug,status,lead_source
  )
  select w.id,v_lead_template_id,v_lead_version_id,'New Tax Client Lead Form',
    lower(regexp_replace(w.slug,'[^a-zA-Z0-9-]','','g'))||'-tax-lead','draft','website_lead_form'
  from public.workspaces w where w.workspace_type<>'platform_admin'
  on conflict (public_slug) do nothing;
end;
$$;

commit;
