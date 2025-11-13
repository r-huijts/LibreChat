const appleLogin = require('./appleStrategy');
const passportLogin = require('./localStrategy');
const googleLogin = require('./googleStrategy');
const githubLogin = require('./githubStrategy');
const discordLogin = require('./discordStrategy');
const facebookLogin = require('./facebookStrategy');
const jwtLogin = require('./jwtStrategy');
const ldapLogin = require('./ldapStrategy');
const { setupSaml } = require('./samlStrategy');
const openIdJwtLogin = require('./openIdJwtStrategy');

let openIdModule;

const getOpenIdModule = () => {
  if (!openIdModule) {
    openIdModule = require('./openidStrategy');
  }
  return openIdModule;
};

const setupOpenId = (...args) => getOpenIdModule().setupOpenId(...args);
const getOpenIdConfig = (...args) => getOpenIdModule().getOpenIdConfig(...args);

module.exports = {
  appleLogin,
  passportLogin,
  googleLogin,
  githubLogin,
  discordLogin,
  jwtLogin,
  facebookLogin,
  setupOpenId,
  getOpenIdConfig,
  ldapLogin,
  setupSaml,
  openIdJwtLogin,
};
