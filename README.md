Poké-Catcher: An Automated Pokétwo Bot
⚠️ Aviso Importante: Este bot utiliza la automatización de la cuenta de usuario (un "self-bot"). Esto va en contra de los Términos de Servicio de Discord. El uso de este programa puede resultar en la suspensión o baneo de su cuenta de usuario. Úselo bajo su propio riesgo.

Descripción del Proyecto
Poké-Catcher es un bot de Discord de código abierto y completamente automatizado, diseñado para simplificar la captura de Pokémon en el popular juego Pokétwo. Este programa se centra en la eficiencia y la seguridad de la cuenta del usuario, ofreciendo una experiencia de captura autónoma y sin complicaciones.

Características Destacadas
Configuración Sencilla: La configuración es tan fácil como ingresar el token de su cuenta principal y la ID de su cuenta maestra en el archivo config.json.

Captura Rápida y Precisa: El bot es capaz de atrapar Pokémon casi instantea como a velocidad humana después de que aparecen, incluso en servidores con mucho tráfico o durante inciensos.

Detección de Nombres de Bots: Está diseñado para trabajar en conjunto con otros bots de terceros (como poke-name o P2assistant) para obtener el nombre del Pokémon de forma rápida, minimizando la necesidad de usar el comando de pista( @poketwo hint ).

Resistencia a Pokétwo: Si el bot no recibe un nombre de un bot auxiliar, solicitará una pista y la resolverá para identificar al Pokémon. Incluye un sistema de reintentos en caso de una captura fallida.

Protocolo de Seguridad contra Captchas: En caso de que Pokétwo envíe un mensaje de captcha, el bot se pausa automáticamente para evitar un baneo. El bot notifica a los dueños a través de DM para que resuelvan el captcha.

Registro de Capturas Detallado: Cada Pokémon capturado se registra en un canal de su elección. El registro incluye el nombre del Pokémon, género, nivel, IV (Individual Values), el servidor, el canal de origen y un enlace directo al mensaje de captura.

Flexibilidad de Captura: Puede configurar el bot para atrapar todos los Pokémon o solo los que estén en una lista específica.

Comandos de Control: Use comandos de chat como !c <nombre> para manipular el bot. tambien puede usar el comando !trade para reaccionar a botones como ( Accept , Reject, Yes, Yes nuy XP blocker ) etc.

Código Abierto: El código es completamente transparente y está disponible en este repositorio. Puedes revisarlo.

Cómo Usarlo
Clone el repositorio.

Instale las dependencias (npm install).

Abra el archivo config.json y complete los campos con su token de usuario y las IDs, el resto puede hacerlo con comandos desde discord.

Inicie el bot (node index.js ).
para mas detalles de uso solicite ayuda con el comando   !help
