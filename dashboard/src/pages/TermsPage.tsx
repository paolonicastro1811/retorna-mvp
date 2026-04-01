import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="border-b border-gray-200 py-5">
        <div className="max-w-[720px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#1a1a2e]">Retorna</Link>
          <Link to="/" className="text-sm text-[#6b7280] hover:text-[#2d2d3a]">Voltar ao inicio</Link>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-6 py-12">
        <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">Termos de Uso</h1>
        <p className="text-sm text-[#6b7280] mb-8">Ultima atualizacao: 1 de abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-[#2d2d3a] leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">1. Aceitacao dos termos</h2>
            <p>
              Ao acessar ou utilizar a plataforma Retorna (&quot;Plataforma&quot;), voce concorda com estes Termos de Uso.
              Se voce nao concorda com algum dos termos, nao utilize a Plataforma. O uso continuado apos
              alteracoes constitui aceitacao dos termos atualizados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">2. Descricao do servico</h2>
            <p>
              A Retorna e uma plataforma SaaS (Software as a Service) que permite a restaurantes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gerenciar uma base de clientes com historico de visitas e gastos.</li>
              <li>Identificar automaticamente clientes inativos ou em risco de inatividade.</li>
              <li>Criar e enviar campanhas de reativacao via WhatsApp Business API.</li>
              <li>Medir o retorno sobre investimento (ROI) das campanhas com atribuicao de receita.</li>
              <li>Registrar visitas e acompanhar metricas de desempenho.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">3. Cadastro e conta</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Para utilizar a Plataforma, voce deve criar uma conta fornecendo informacoes verdadeiras e atualizadas.</li>
              <li>A autenticacao e feita via magic link enviado por email — nao ha senhas.</li>
              <li>Voce e responsavel por manter a seguranca do email associado a sua conta.</li>
              <li>Cada conta esta vinculada a um unico restaurante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">4. Uso do WhatsApp Business API</h2>
            <p>Ao conectar seu numero de WhatsApp a Plataforma, voce declara e garante que:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Possui autorizacao legal para enviar mensagens aos seus clientes.</li>
              <li>Os clientes forneceram consentimento para receber comunicacoes via WhatsApp.</li>
              <li>Cumprira as <strong>Politicas de Comercio</strong> e <strong>Politicas de Mensagens Comerciais</strong> da Meta.</li>
              <li>Incluira opcao de opt-out (descadastro) em todas as mensagens.</li>
              <li>Nao enviara conteudo spam, enganoso, ilegal ou que viole direitos de terceiros.</li>
            </ul>
            <p className="mt-2">
              A Retorna nao se responsabiliza pelo conteudo das mensagens enviadas pelo restaurante.
              O uso indevido da API do WhatsApp pode resultar em suspensao da conta pela Meta e/ou pela Retorna.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">5. Responsabilidades do usuario</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Manter os dados dos clientes atualizados e precisos.</li>
              <li>Respeitar os pedidos de opt-out dos clientes finais.</li>
              <li>Cumprir a LGPD e demais legislacoes aplicaveis de protecao de dados.</li>
              <li>Nao utilizar a Plataforma para fins ilegais, fraudulentos ou abusivos.</li>
              <li>Nao tentar acessar dados de outros restaurantes ou interferir no funcionamento da Plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">6. Protecao de dados e LGPD</h2>
            <p>
              A Retorna atua como <strong>operadora de dados</strong> em relacao aos dados dos clientes finais,
              e o restaurante atua como <strong>controlador</strong>. As responsabilidades sao:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Controlador (restaurante):</strong> garantir base legal para o tratamento, atender solicitacoes dos titulares, obter consentimento quando necessario.</li>
              <li><strong>Operadora (Retorna):</strong> tratar dados conforme instrucoes do controlador, implementar medidas de seguranca adequadas, notificar incidentes.</li>
            </ul>
            <p className="mt-2">
              Para mais detalhes, consulte nossa <Link to="/privacy" className="text-[#25D366] font-semibold hover:underline">Politica de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">7. Propriedade intelectual</h2>
            <p>
              A Plataforma, incluindo seu codigo, design, marca e conteudo, e propriedade da Retorna.
              O usuario recebe uma licenca limitada, nao exclusiva e revogavel para uso da Plataforma
              conforme estes termos. E proibido copiar, modificar, distribuir ou criar obras derivadas
              da Plataforma sem autorizacao expressa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">8. Disponibilidade e limitacoes</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Plataforma e fornecida &quot;como esta&quot; (as is), sem garantias de disponibilidade ininterrupta.</li>
              <li>Podemos realizar manutencoes programadas com aviso previo sempre que possivel.</li>
              <li>O envio de mensagens depende da disponibilidade da API do WhatsApp Business (Meta), sobre a qual nao temos controle.</li>
              <li>Nao garantimos taxas de entrega, leitura ou resposta das mensagens.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">9. Limitacao de responsabilidade</h2>
            <p>
              Na maxima extensao permitida por lei, a Retorna nao sera responsavel por:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Danos indiretos, incidentais ou consequenciais decorrentes do uso da Plataforma.</li>
              <li>Perda de receita, lucros ou dados causada por interrupcoes no servico.</li>
              <li>Acoes da Meta, incluindo suspensao ou restricao do numero de WhatsApp do usuario.</li>
              <li>Conteudo das mensagens criadas e enviadas pelo restaurante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">10. Suspensao e cancelamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Podemos suspender ou encerrar sua conta em caso de violacao destes termos.</li>
              <li>Voce pode cancelar sua conta a qualquer momento entrando em contato conosco.</li>
              <li>Apos o cancelamento, seus dados serao retidos por 30 dias e depois permanentemente excluidos, salvo obrigacao legal em contrario.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">11. Alteracoes nos termos</h2>
            <p>
              Podemos atualizar estes Termos de Uso periodicamente. Alteracoes significativas serao comunicadas
              por email ou notificacao no painel com pelo menos 15 dias de antecedencia. O uso continuado da
              Plataforma apos as alteracoes constitui aceitacao dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">12. Lei aplicavel e foro</h2>
            <p>
              Estes termos sao regidos pelas leis da Republica Federativa do Brasil.
              Fica eleito o foro da comarca de Sao Paulo/SP para dirimir quaisquer controversias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">13. Contato</h2>
            <p>Para duvidas sobre estes termos:</p>
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
