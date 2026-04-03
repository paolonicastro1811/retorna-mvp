import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="border-b border-gray-200 py-5">
        <div className="max-w-[720px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#1a1a2e]">Retorna</Link>
          <Link to="/" className="text-sm text-[#6b7280] hover:text-[#2d2d3a]">Voltar ao início</Link>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-6 py-12">
        <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">Termos de Uso</h1>
        <p className="text-sm text-[#6b7280] mb-8">Última atualização: 1 de abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-[#2d2d3a] leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">1. Aceitação dos termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma Retorna (&quot;Plataforma&quot;), você concorda com estes Termos de Uso.
              Se você não concorda com algum dos termos, não utilize a Plataforma. O uso continuado após
              alterações constitui aceitação dos termos atualizados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">2. Descrição do serviço</h2>
            <p>
              A Retorna é uma plataforma SaaS (Software as a Service) que permite a restaurantes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gerenciar uma base de clientes com histórico de visitas e gastos.</li>
              <li>Identificar automaticamente clientes inativos ou em risco de inatividade.</li>
              <li>Criar e enviar campanhas de reativação via WhatsApp Business API.</li>
              <li>Medir o retorno sobre investimento (ROI) das campanhas com atribuição de receita.</li>
              <li>Registrar visitas e acompanhar métricas de desempenho.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">3. Cadastro e conta</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Para utilizar a Plataforma, você deve criar uma conta fornecendo informações verdadeiras e atualizadas.</li>
              <li>A autenticação é feita via magic link enviado por email — não há senhas.</li>
              <li>Você é responsável por manter a segurança do email associado à sua conta.</li>
              <li>Cada conta está vinculada a um único restaurante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">4. Uso do WhatsApp Business API</h2>
            <p>Ao conectar seu número de WhatsApp à Plataforma, você declara e garante que:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Possui autorização legal para enviar mensagens aos seus clientes.</li>
              <li>Os clientes forneceram consentimento para receber comunicações via WhatsApp.</li>
              <li>Cumprirá as <strong>Políticas de Comércio</strong> e <strong>Políticas de Mensagens Comerciais</strong> da Meta.</li>
              <li>Incluirá opção de opt-out (descadastro) em todas as mensagens.</li>
              <li>Não enviará conteúdo spam, enganoso, ilegal ou que viole direitos de terceiros.</li>
            </ul>
            <p className="mt-2">
              A Retorna não se responsabiliza pelo conteúdo das mensagens enviadas pelo restaurante.
              O uso indevido da API do WhatsApp pode resultar em suspensão da conta pela Meta e/ou pela Retorna.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">5. Responsabilidades do usuário</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Manter os dados dos clientes atualizados e precisos.</li>
              <li>Respeitar os pedidos de opt-out dos clientes finais.</li>
              <li>Cumprir a LGPD e demais legislações aplicáveis de proteção de dados.</li>
              <li>Não utilizar a Plataforma para fins ilegais, fraudulentos ou abusivos.</li>
              <li>Não tentar acessar dados de outros restaurantes ou interferir no funcionamento da Plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">6. Proteção de dados e LGPD</h2>
            <p>
              A Retorna atua como <strong>operadora de dados</strong> em relação aos dados dos clientes finais,
              e o restaurante atua como <strong>controlador</strong>. As responsabilidades são:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Controlador (restaurante):</strong> garantir base legal para o tratamento, atender solicitações dos titulares, obter consentimento quando necessário.</li>
              <li><strong>Operadora (Retorna):</strong> tratar dados conforme instruções do controlador, implementar medidas de segurança adequadas, notificar incidentes.</li>
            </ul>
            <p className="mt-2">
              Para mais detalhes, consulte nossa <Link to="/privacy" className="text-[#25D366] font-semibold hover:underline">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">7. Propriedade intelectual</h2>
            <p>
              A Plataforma, incluindo seu código, design, marca e conteúdo, é propriedade da Retorna.
              O usuário recebe uma licença limitada, não exclusiva e revogável para uso da Plataforma
              conforme estes termos. É proibido copiar, modificar, distribuir ou criar obras derivadas
              da Plataforma sem autorização expressa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">8. Disponibilidade e limitações</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Plataforma é fornecida &quot;como está&quot; (as is), sem garantias de disponibilidade ininterrupta.</li>
              <li>Podemos realizar manutenções programadas com aviso prévio sempre que possível.</li>
              <li>O envio de mensagens depende da disponibilidade da API do WhatsApp Business (Meta), sobre a qual não temos controle.</li>
              <li>Não garantimos taxas de entrega, leitura ou resposta das mensagens.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">9. Limitação de responsabilidade</h2>
            <p>
              Na máxima extensão permitida por lei, a Retorna não será responsável por:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Danos indiretos, incidentais ou consequenciais decorrentes do uso da Plataforma.</li>
              <li>Perda de receita, lucros ou dados causada por interrupções no serviço.</li>
              <li>Ações da Meta, incluindo suspensão ou restrição do número de WhatsApp do usuário.</li>
              <li>Conteúdo das mensagens criadas e enviadas pelo restaurante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">10. Suspensão e cancelamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Podemos suspender ou encerrar sua conta em caso de violação destes termos.</li>
              <li>Você pode cancelar sua conta a qualquer momento entrando em contato conosco.</li>
              <li>Após o cancelamento, seus dados serão retidos por 30 dias e depois permanentemente excluídos, salvo obrigação legal em contrário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">11. Alterações nos termos</h2>
            <p>
              Podemos atualizar estes Termos de Uso periodicamente. Alterações significativas serão comunicadas
              por email ou notificação no painel com pelo menos 15 dias de antecedência. O uso continuado da
              Plataforma após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">12. Lei aplicável e foro</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil.
              Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">13. Contato</h2>
            <p>Para dúvidas sobre estes termos:</p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong>Email:</strong> contato@retornabrasil.com</li>
              <li><strong>Plataforma:</strong> retornabrasil.com</li>
            </ul>
          </section>

        </div>
      </main>

      <footer className="text-center py-6 text-[0.8rem] text-[#6b7280] border-t border-gray-200">
        <div className="max-w-[720px] mx-auto px-6">
          Retorna &copy; 2026 &middot; Todos os direitos reservados
          <div className="mt-2 space-x-4">
            <Link to="/privacy" className="hover:underline">Privacidade</Link>
            <Link to="/termos" className="hover:underline">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
