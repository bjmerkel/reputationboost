-- Allow in-app notifications when a scheduled Google post fails to publish.

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (
    type in (
      'suggestion_created',
      'experiment_queued',
      'experiment_concluded',
      'scheduled_post_failed'
    )
  );
