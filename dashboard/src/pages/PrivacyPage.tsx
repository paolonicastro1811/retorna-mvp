import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-[#2d2d3a]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="border-b border-gray-200 py-5">
        <div className="max-w-[720px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="text-xl font-extrabold text-[#1a1a2e]">Retorna</Link>
          <Link to="/" className="text-sm text-[#6b7280] hover:text-[#2d2d3a]">Voltar ao início</Link>
        </div>
      </header>

      <main className="max-w-[720px] mx-auto px-6 py-12">
        <h1 className="text-2xl font-extrabold text-[#1a1a2e] mb-2">Política de Privacidade</h1>
        <p className="text-sm text-[#6b7280] mb-8">Última atualização: 1 de abril de 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-[#2d2d3a] leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">1. Introdução</h2>
            <p>
              A Retorna (&quot;nós&quot;, &quot;nosso&quot; ou &quot;Plataforma&quot;) é uma plataforma SaaS que ajuda restaurantes a
              reativar clientes inativos via WhatsApp. Esta Política de Privacidade descreve como coletamos,
              usamos, armazenamos e protegemos os dados pessoais de nossos usuários (proprietários de restaurantes)
              e dos clientes finais dos restaurantes, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">2. Dados que coletamos</h2>

            <h3 className="text-base font-semibold mt-4 mb-1">2.1 Dados dos proprietários de restaurantes</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome e email (para login via magic link)</li>
              <li>Nome do restaurante</li>
              <li>Número de telefone do WhatsApp Business</li>
              <li>Credenciais de integração com a API do WhatsApp Business (Meta)</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-1">2.2 Dados dos clientes finais</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nome (quando fornecido)</li>
              <li>Número de telefone</li>
              <li>Histórico de visitas (datas e valores gastos)</li>
              <li>Status de ciclo de vida (ativo, em risco, inativo)</li>
              <li>Preferência de opt-in/opt-out para comunicações</li>
            </ul>

            <h3 className="text-base font-semibold mt-4 mb-1">2.3 Dados de uso</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Logs de acesso ao painel</li>
              <li>Métricas de campanhas (mensagens enviadas, entregues, lidas)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">3. Como usamos os dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Prestação do serviço:</strong> identificar clientes inativos, enviar campanhas de reativação via WhatsApp e atribuir receita gerada.</li>
              <li><strong>Autenticação:</strong> enviar magic links por email para login seguro.</li>
              <li><strong>Análise e relatórios:</strong> gerar KPIs e relatórios de desempenho para o restaurante.</li>
              <li><strong>Melhoria do serviço:</strong> analisar padrões de uso agregados para aprimorar a plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">4. Base legal (LGPD)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Execução de contrato</strong> (Art. 7, V): processamento necessário para fornecer o serviço contratado.</li>
              <li><strong>Consentimento</strong> (Art. 7, I): clientes finais podem optar por não receber mensagens (opt-out).</li>
              <li><strong>Interesse legítimo</strong> (Art. 7, IX): análise agregada para melhoria do serviço.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">5. Compartilhamento de dados</h2>
            <p>Compartilhamos dados apenas com os seguintes terceiros, estritamente necessários para o funcionamento do serviço:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Meta (WhatsApp Business API):</strong> números de telefone e conteúdo das mensagens para envio via WhatsApp.</li>
              <li><strong>Resend:</strong> endereços de email para envio de magic links de autenticação.</li>
              <li><strong>Neon (PostgreSQL):</strong> armazenamento de dados em banco de dados com criptografia em repouso.</li>
              <li><strong>Anthropic (Claude AI):</strong> texto anonimizado das mensagens recebidas para classificação de intenção (nenhum dado pessoal identificável é enviado).</li>
            </ul>
            <p className="mt-2">Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins de marketing.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">6. Armazenamento e segurança</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dados armazenados em servidores com criptografia em trânsito (TLS) e em repouso.</li>
              <li>Autenticação sem senha (magic link) para eliminar riscos de senhas fracas.</li>
              <li>Tokens JWT com expiração de 30 dias.</li>
              <li>Acesso restrito a dados do restaurante via autenticação e autorização por restaurantId.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">7. Retenção de dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Dados de clientes:</strong> mantidos enquanto o restaurante tiver conta ativa na plataforma.</li>
              <li><strong>Logs de campanhas:</strong> mantidos por 12 meses após o envio.</li>
              <li><strong>Magic link tokens:</strong> excluídos automaticamente após uso ou expiração (15 minutos).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">8. Direitos dos titulares (LGPD)</h2>
            <p>Você tem os seguintes direitos garantidos pela LGPD:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessar uma cópia.</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos ou desatualizados.</li>
              <li><strong>Anonimização ou eliminação:</strong> solicitar a exclusão de dados desnecessários.</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</li>
              <li><strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
              <li><strong>Eliminação completa:</strong> solicitar a exclusão total dos seus dados (função &quot;Excluir dados LGPD&quot; disponível no painel).</li>
            </ul>
            <p className="mt-2">
              Os clientes finais dos restaurantes podem solicitar a exclusão de seus dados a qualquer momento.
              O restaurante pode exercer esse direito diretamente pelo painel, utilizando a função de exclusão LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">9. Opt-out de mensagens</h2>
            <p>
              Todas as mensagens enviadas via WhatsApp incluem instruções claras para o destinatário se descadastrar.
              Ao responder com &quot;PARAR&quot; ou &quot;SAIR&quot;, o cliente é automaticamente marcado como opt-out e não receberá
              mais mensagens de campanha.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">10. Cookies</h2>
            <p>
              A plataforma utiliza apenas cookies essenciais para autenticação (token JWT armazenado em localStorage).
              Não utilizamos cookies de rastreamento, analytics ou publicidade de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">11. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações significativas serão comunicadas
              por email ou notificação no painel. A data de &quot;última atualização&quot; no topo indica a versão vigente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">12. Contato</h2>
            <p>
              Para exercer seus direitos, tirar dúvidas ou fazer reclamações sobre o tratamento de dados pessoais:
            </p>
            <ul className="list-none space-y-1 mt-2">
              <li><strong>Email:</strong> privacidade@retornabrasil.com</li>
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
