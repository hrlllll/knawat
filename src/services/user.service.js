const  ESService  = require('moleculer-elasticsearch');
const { v4: uuidv4 } = require('uuid');
const jwt = require("jsonwebtoken");
const {pbkdf2} = require("crypto");

module.exports = {
    name: 'user',
    mixins: [ESService],
    settings: {
        elasticsearch: {
            host: process.env.ELASTICSEARCH_HOST || "http://localhost:9200",
            apiVersion: "6.8"
        }
    },
    actions: {
        login: {
            params: {
                email: 'string',
                password: 'string'
            },
            async handler(ctx) {
                let { email, password } = ctx.params;
                let user = await this.findUser({email : email});
                if (user) {
                    let hashPass = await this.encryptPassword(password)
                    if (user._source.password === hashPass) {
                        let token = await this.generateToken(user)
                        ctx.meta.$responseHeaders = {
                            "x-auth-token": `Bearer${token}`
                        };
                        ctx.meta.$statusCode = 200;
                        return {email : user._source.email, userId : user._id};
                    }else {
                        ctx.meta.$statusCode = 401;
                        return {error : "username or password is wrong"};
                    }

                }
                else {
                    ctx.meta.$statusCode = 401;
                    return {error : "username or password is wrong"};
                }

            },
        },

        register: {
            params: {
                email: 'string',
                password: 'string',
            },

            async handler(ctx) {

                const { email, password } = ctx.params;
                let user = await this.findUser({email: email});
                if (!user) {
                    let newPassword = await this.encryptPassword(password);
                    return this.client.create({
                        index: "user",
                        id: uuidv4(),
                        type: "doc",
                        body: { email: email, password: newPassword }
                    })
                }
                else {
                    ctx.meta.$statusCode = 400;
                    return {error : "duplicate user"}
                }
            },
        },

    },

    methods : {
        async findUser(query) {
            return new Promise(async (resolve, reject) => {
                let user = await this.client.search({
                    index : 'user',
                    body: {
                        query: {
                            match_phrase: query
                        }
                    }
                })
                if (user.hits.hits.length !== 0) {
                    resolve(user.hits.hits[0])
                }
                else {
                    resolve(null)
                }
            })
        },
        async encryptPassword(password) {
            return new Promise((resolve, reject) => {

                pbkdf2(password, "salt", 1, 32, "sha512", (err, derivedKey) => {
                    if (err) {
                        reject(err) ;
                    }
                    resolve(derivedKey.toString("hex")) ;
                });
            })


        },
        async generateToken(user) {
            return new Promise((resolve, reject) => {
                const privateJWTKey = "1j3425n231t!$%#T^WGHrweyt2343"
                resolve(jwt.sign(user, privateJWTKey, { expiresIn: '1h' }));
            })


        }
    }
};
