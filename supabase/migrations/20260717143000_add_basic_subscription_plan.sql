alter table wing.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table wing.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'basic', 'pro', 'team', 'enterprise'));
