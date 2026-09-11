alter table public.app_settings
  add column if not exists document_header_note text not null default '',
  add column if not exists document_footer_note text not null default '',
  add column if not exists quote_terms text not null default 'Este documento representa uma estimativa com base nos itens e serviços informados. Valores podem ser atualizados mediante diagnóstico e aprovação do cliente.',
  add column if not exists work_order_terms text not null default 'Autorizo a execução dos serviços e a aplicação das peças descritas neste documento, conforme condições e valores registrados no sistema.',
  add column if not exists receipt_note text not null default 'Obrigado pela preferência.',
  add column if not exists whatsapp_greeting text not null default 'Olá! Aqui é da equipe da COMPACT Centro Automotivo.',
  add column if not exists whatsapp_quote_message text not null default 'Preparamos o seu orçamento. Confira os itens, valores e fale conosco em caso de dúvidas.',
  add column if not exists whatsapp_tracking_message text not null default 'Você pode acompanhar o andamento do seu veículo pelo link exclusivo abaixo.',
  add column if not exists whatsapp_ready_message text not null default 'Seu veículo está pronto. Entre em contato conosco para combinar a retirada.',
  add column if not exists require_payment_before_delivery boolean not null default true,
  add column if not exists allow_partial_approval boolean not null default true;
