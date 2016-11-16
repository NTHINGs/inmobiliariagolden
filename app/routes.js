// app/routes.js
var multer  = require('multer')
var fs = require('fs');
var bcrypt = require('bcrypt-nodejs');
var Feed = require('feed');
var gm = require('gm').subClass({ imageMagick: true });
var upload = multer({ 
    dest: 'assets/fotoscasas/',
    rename: function(fieldname, filename) {
        return filename;
    },
    onFileUploadStart: function(file) {
        if(file.mimetype !== 'image/jpg' && file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
            return false;
        }
    } 
});
module.exports = function(app, passport, connection) {
    app.get("/", function(req, res) {
        connection.query('SELECT * FROM propiedades', function(err, propiedades){
            connection.query('SELECT nombre, telefono, foto FROM asesores',function(err, asesores){
                res.render('index.ejs', {
                    propiedades: propiedades,
                    asesores: asesores,
                });
            });
        });
    });

    app.post("/", function(req, res) {
        console.log(req.body);
        var bañosrecamaras="";
        var valores=[req.body.tipo, req.body.propiedad];
        if(req.body.recamaras != "indistinto"){
            bañosrecamaras+=" AND recamaras = ?";
            valores.push(req.body.recamaras);
        }
        if(req.body.baños != "indistinto"){
            bañosrecamaras+=" AND baños = ?";
            valores.push(req.body.baños);
        }
        connection.query('SELECT * FROM propiedades WHERE renta = ? AND tipo = ?'+bañosrecamaras,valores, function(err, propiedades){
            connection.query('SELECT nombre, telefono, foto FROM asesores',function(err, asesores){
                console.log(propiedades);
                res.render('index.ejs', {
                    propiedades: propiedades,
                    asesores: asesores,
                    eliminar: 1,
                });
            });
        });
    });

    app.get('/login', function(req,res) {
        res.render('login.ejs',{ message: req.flash('loginMessage') });
    });
    
    app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/panel', // redirect to the secure profile section
        failureRedirect : '/login', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    app.get("/propiedad",function(req,res) {
        connection.query('SELECT * FROM propiedades P, asesores A WHERE P.idpropiedades = ? AND A.idasesores=P.asesores_idasesores', [req.query.id], function(err, propiedad) {
            connection.query('SELECT * FROM fotos WHERE propiedades_idpropiedades=?',[req.query.id],function(err,fotos) {
              console.log(fotos);
              res.render('propiedad.ejs', {
                  propiedad: propiedad[0],
                  fotos: fotos,
              });  
            });
        });
    });

    app.get('/panel', isLoggedIn, function(req, res) {
        connection.query('SELECT nombrepropiedad, idpropiedades,fechacreacion,url FROM propiedades WHERE `vendida` = 0 AND `asesores_idasesores` = ?',[req.user.idasesores],function(err, propiedades){
            connection.query('SELECT nombrepropiedad, idpropiedades, fechaventa,url FROM propiedades WHERE `vendida` = 1 AND `asesores_idasesores` = ?',[req.user.idasesores],function(err, propiedadesvendidas){
                connection.query('SELECT idasesores, nombre, foto FROM asesores',function(err, asesores){
                    if (typeof(req.query.agregado) != 'undefined') {
                        if(req.query.agregado == "1"){
                           res.render('panel.ejs', {
                               propiedades: propiedades,
                               propiedadesvendidas: propiedadesvendidas,
                               asesores: asesores,
                               user : req.user,
                               titulomensaje: "¡Éxito!",
                               mensaje: "Agregado Con Éxito",
                           }); 
                        }else{
                            res.render('panel.ejs', {
                                propiedades: propiedades,
                                propiedadesvendidas: propiedadesvendidas,
                                asesores: asesores,
                                user : req.user,
                                titulomensaje: "¡ERROR!",
                                mensaje: "ERROR EN AGREGAR, INTENTALO DE NUEVO",
                            });
                        }
                    }else{
                        res.render('panel.ejs', {
                            propiedades: propiedades,
                            propiedadesvendidas: propiedadesvendidas,
                            asesores: asesores,
                            user : req.user,
                        });
                    }
                });
            });
        });
    });

    app.post('/agregarpropiedad',isLoggedIn,upload.array('image'), function(req, res) {
        /*Agregar propiedad*/
        var ventaorenta = 0;
        if(req.body.ventaorenta != 0){
            ventaorenta = 1;
        }
        var fecha = new Date().toISOString().substring(0, 10);

        /*Subir foto*/
        console.log(req.files);
        console.log(req.body);
        if(typeof(req.files) != 'undefined' && req.files.length > 0){
            connection.query('INSERT INTO propiedades (tipo, nombrepropiedad, precio, m2, recamaras, baños, descripcion, direccion, latitud, longitud, renta, vendida, fechaventa,fechacreacion, url, asesores_idasesores) VALUES (?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[req.body.tipo, req.body.nombrepropiedad,req.body.precio,req.body.m2,req.body.recamaras,req.body.baños,req.body.descripcion,req.body.direccion,req.body.latitud,req.body.longitud,ventaorenta,0,null,fecha,'/fotoscasas/'+req.files[0].filename,req.user.idasesores], function(err, result){
                if (err) {
                    console.log(err);
                    res.redirect('/panel?agregado=0');
                }else{
                    for(var i=1;i < req.files.length;i++){
                        console.log("i: "+i+"files: "+req.files.length+"length-1: "+(req.files.length-1));
                        connection.query('INSERT INTO fotos (url, propiedades_idpropiedades) VALUES(?,?)',['/fotoscasas/'+req.files[i].filename,result.insertId],function(err,result2) {
                            if(err){
                                console.log(err);
                                res.redirect('/panel?agregado=0');
                            }
                        });
                    }
                }
            });        
        }else{
            /*NO HAY IMAGEN PRINCIPAL*/
            connection.query('INSERT INTO propiedades (tipo, nombrepropiedad, precio, m2, recamaras, baños, descripcion, direccion, latitud, longitud, renta, vendida, fechaventa,fechacreacion, asesores_idasesores) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[req.body.tipo, req.body.nombrepropiedad,req.body.precio,req.body.m2,req.body.recamaras,req.body.baños,req.body.descripcion,req.body.direccion,req.body.latitud,req.body.longitud,ventaorenta,0,null,fecha,req.user.idasesores], function(err, result){
                if (err) {
                    console.log(err);
                    res.redirect('/panel?agregado=0');
                }
            });
        }
        res.redirect('/panel?agregado=1');
    });

    app.get('/vendida',isLoggedIn,function(req, res) {
        var fecha = new Date().toISOString().substring(0, 10);
        connection.query('UPDATE propiedades SET vendida = 1, fechaventa = ? WHERE idpropiedades = ?',[fecha, req.query.id], function(err, result){
            if (err) {
                console.log(err);
            }
            res.redirect('/panel');
        });
    });

    app.get('/deshacervendida',isLoggedIn,function(req, res) {
        connection.query('UPDATE propiedades SET vendida = 0 WHERE idpropiedades = ?',[req.query.id], function(err, result){
            if (err) {
                console.log(err);
            }
            res.redirect('/panel');
        });
    });

    app.post('/eliminarpropiedad',isLoggedIn,function(req, res) {
        connection.query('SELECT url FROM propiedades WHERE idpropiedades = ?',[req.body.id], function(err, result){
            console.log(result);
            if(result[0].url != "../picture.png"){
                fs.unlink("assets"+result[0].url,function(err) {
                    console.log(err);
                });   
            }
            connection.query('SELECT url FROM fotos WHERE propiedades_idpropiedades = ?',[req.body.id], function(err, fotos){
                fotos.forEach(function(foto){
                    if(foto.url != "../picture.png"){
                        fs.unlink("assets"+foto.url,function(err) {
                            console.log(err);
                        });   
                    }
                });
                connection.query('DELETE FROM fotos WHERE propiedades_idpropiedades = ?',[req.body.id], function(err, result){
                    if (err) {
                        console.log(err);
                        res.redirect('/panel');
                    }
                    connection.query('DELETE FROM propiedades WHERE idpropiedades = ?',[req.body.id], function(err, result){
                        if (err) {
                            console.log(err);
                            res.redirect('/panel');
                        }
                        res.redirect('/panel');
                    });
                });
            });
        });
    });

    app.get('/editarpropiedad',isLoggedIn,function(req, res) {
        connection.query('SELECT * FROM propiedades WHERE idpropiedades = ?',[req.query.id], function(err, propiedad){
            connection.query('SELECT * FROM fotos WHERE propiedades_idpropiedades = ?',[req.query.id], function(err, fotos){
                console.log(propiedad);
                if (typeof(req.query.cambio) != 'undefined') {
                    if(req.query.cambio == "1"){
                        res.render('editarpropiedad.ejs', {
                            propiedad: propiedad[0],
                            fotos:fotos,
                            user : req.user,
                            titulomensaje: "¡Éxito!",
                            mensaje: "Editado Con Éxito",
                        }); 
                    }else{
                        res.render('editarpropiedad.ejs', {
                            propiedad: propiedad[0],
                            fotos:fotos,
                            user : req.user,
                            titulomensaje: "¡Error!",
                            mensaje: "Ocurrió Un Error",
                        });
                    }
                }else{
                    res.render('editarpropiedad.ejs', {
                        propiedad: propiedad[0],
                        fotos:fotos,
                        user : req.user,
                    });
                }
            });      
        });
    });

    var cpUpload = upload.fields([{ name: 'principal'}, { name: 'image'}, { name: 'nuevas'}])
    app.post('/editarpropiedad',isLoggedIn,cpUpload,function(req, res) {
        console.log(req.body);
        console.log(req.files);
        var ventaorenta = 0;
        if(req.body.ventaorenta != 0){
            ventaorenta = 1;
        }
        function fotosNuevas() {
            // body...
            if(typeof(req.files['nuevas']) != 'undefined'){
                for (var i = 0; i < req.files['nuevas'].length; i++) {
                    connection.query('INSERT INTO fotos (url, propiedades_idpropiedades) VALUES(?,?)',['/fotoscasas/'+req.files['nuevas'][i].filename,req.body.id],function(err,result) {
                        console.log("NUEVA IMAGEN AGREGADA");
                    });
                }
                res.redirect('/editarpropiedad?id='+req.body.id+'&cambio=1');
            }else{
                res.redirect('/editarpropiedad?id='+req.body.id+'&cambio=1');
            }
        }
        /*No se cambio la foto principal*/
        if(typeof(req.files['principal']) == 'undefined'){
            connection.query('UPDATE propiedades SET tipo = ?, nombrepropiedad = ?, precio = ?, m2 = ?, recamaras = ?, baños = ?, descripcion = ?, direccion = ?, latitud = ?, longitud = ?, renta = ? WHERE idpropiedades = ?',[req.body.tipo, req.body.nombrepropiedad, req.body.precio, req.body.m2, req.body.recamaras, req.body.baños, req.body.descripcion, req.body.direccion, req.body.latitud, req.body.longitud, ventaorenta, req.body.id], function(err, result){
                console.log(err);
                if(typeof(req.files['image']) != 'undefined'){
                    connection.query('SELECT url FROM fotos WHERE propiedades_idpropiedades = ?',[req.body.id], function(err, fotos){
                        console.log(err);
                        if(typeof(fotos) != 'undefined'){
                            /*Reemplazar fotos*/
                            var a = 0;
                            for (var i = 0; i < req.body.fotos.length; i++) {
                                if(req.body.fotos[i]!=''){
                                        fs.unlink("assets"+fotos[i].url,function(err) {
                                            console.log(err);
                                        });   
                                    connection.query('UPDATE fotos SET url = ? WHERE url = ?',['/fotoscasas/'+req.files['image'][a].filename,fotos[i].url], function(err, result){
                                        console.log("updated"); 
                                    });
                                    a++;
                                }
                            }
                            fotosNuevas();
                        }else{
                            fotosNuevas();
                        }
                    }); 
                }else{
                    fotosNuevas();
                }
            });
        }else{
            /*Cambio la foto principal*/
            connection.query('SELECT url FROM propiedades WHERE idpropiedades = ?',[req.body.id], function(err, foto){
                if(foto[0].url != "../picture.png"){
                    fs.unlinkSync("assets"+foto[0].url);
                }
                connection.query('UPDATE propiedades SET tipo = ?, nombrepropiedad = ?, precio = ?, m2 = ?, recamaras = ?, baños = ?, descripcion = ?, direccion = ?, latitud = ?, longitud = ?, renta = ?, url = ? WHERE idpropiedades = ?',[req.body.tipo, req.body.nombrepropiedad, req.body.precio, req.body.m2, req.body.recamaras, req.body.baños, req.body.descripcion, req.body.direccion, req.body.latitud, req.body.longitud, ventaorenta, '/fotoscasas/'+req.files['principal'][0].filename, req.body.id], function(err, result){
                    console.log(err);
                        if(typeof(req.files['image']) != 'undefined'){
                            connection.query('SELECT url FROM fotos WHERE propiedades_idpropiedades = ?',[req.body.id], function(err, fotos){
                                console.log(err);
                                if(typeof(fotos) != 'undefined'){
                                    /*Reemplazar fotos*/
                                    var a = 0;
                                    for (var i = 0; i < req.body.fotos.length; i++) {
                                        if(req.body.fotos[i]!=''){
                                            fs.unlink("assets"+fotos[i].url,function(err) {
                                                console.log(err);
                                            });   
                                            connection.query('UPDATE fotos SET url = ? WHERE url = ?',['/fotoscasas/'+req.files['image'][a].filename,fotos[i].url], function(err, result){
                                                console.log("updated"); 
                                            });
                                            a++;
                                        }
                                    }
                                    fotosNuevas();
                                }else{
                                    fotosNuevas();
                                }
                            }); 
                        }else{
                            fotosNuevas();
                        }
                });
            });
        }
    });

    app.post('/eliminarfoto',function(req, res) {
        connection.query('DELETE FROM fotos WHERE url = ?',[req.body.fotourl], function(err, result){
            fs.unlink("assets"+req.body.fotourl,function(err) {
                console.log(err);
                res.redirect('/editarpropiedad?id='+req.body.id+'&cambio=1');
            });   
        });
    });

    app.post('/agregarasesor',isLoggedIn,upload.single('image'), function(req, res) {
        console.log(req.files);
        connection.query("SELECT * FROM asesores WHERE username = ?",[req.body.username], function(err, rows) {
            if (err)
                res.redirect('/panel?agregado=0');
            if (rows.length) {
                /*Existe ese usuario*/
                res.redirect('/panel?agregado=0');
            } else {
                var insertQuery = "INSERT INTO asesores ( nombre, telefono, username, password, socio, foto ) values (?,?,?,?,?,?)";
                connection.query(insertQuery,[req.body.nombre, req.body.telefono, req.body.username, bcrypt.hashSync(req.body.password, null, null), req.body.socio, '/fotoscasas/'+req.file.filename],function(err, rows) {
                    res.redirect('/panel?agregado=1');
                });
            }
        });
    });

    app.get('/editarasesor',isLoggedIn, function(req, res) {
        connection.query('SELECT * FROM asesores WHERE idasesores = ?',[req.user.idasesores],function(err, asesor){
            res.render('editarasesor.ejs',{
                asesor: asesor[0],
                user : req.user,
            });
        });
        
    });

    app.post('/editarasesor',isLoggedIn,upload.single('image'), function(req, res) {
        if(typeof(req.file) != 'undefined'){
            /*Cambio su foto*/
            connection.query('UPDATE asesores SET nombre = ?, telefono = ?, username = ?, password = ?, foto = ? WHERE idasesores = ? ',[req.body.nombre, req.body.telefono, req.body.username, bcrypt.hashSync(req.body.password, null, null), '/fotoscasas/'+req.file.filename,req.user.idasesores], function(err, result){
                res.redirect('/editarasesor');
            });
        }else{
            /*No cambio su foto*/
            connection.query('UPDATE asesores SET nombre = ?, telefono = ?, username = ?, password = ? WHERE idasesores = ? ',[req.body.nombre, req.body.telefono, req.body.username, bcrypt.hashSync(req.body.password, null, null), req.user.idasesores], function(err, result){
                res.redirect('/editarasesor');
            });
        }
    });

    app.post('/eliminarasesor',isLoggedIn, function(req, res) {
        connection.query('UPDATE propiedades SET asesores_idasesores = ? WHERE asesores_idasesores = ? ',[req.body.asesor, req.body.id], function(err, result){
            connection.query('SELECT foto FROM asesores WHERE idasesores = ?',[req.body.id], function(err, foto){
                connection.query('DELETE FROM asesores WHERE idasesores = ?',[req.body.id], function(err, result){
                    if(foto[0].foto != "../picture.png"){
                        fs.unlink("assets"+foto[0].foto,function(err) {
                            console.log(err);
                            res.redirect('/panel');
                        });   
                    }else{
                        res.redirect('/panel');
                    }
                });  
            });
        });
    });

    app.get('/rss', function(req, res) {

        // Initializing feed object
        var feed = new Feed({
            title:          'Obari',
            description:    'Propiedades',
            link:           'https://obari.herokuapp.com/',
            image:          'https://obari.herokuapp.com/logoup.png',
            copyright:      'Copyright © 2016 Obari. All rights reserved',
            author: {
                    name:       'Obari',
                }
        });

        // Function requesting the last 5 posts to a database. This is just an
        // example, use the way you prefer to get your posts.   
        connection.query('SELECT * FROM propiedades', function(err, propiedades){
            propiedades.forEach(function(propiedad) {
                feed.item({
                    title:          propiedad.nombrepropiedad,
                    link:           'https://obari.herokuapp.com/propiedad/?id='+propiedad.idpropiedades,
                    description:    propiedad.descripcion,
                    date:           propiedad.fechacreacion,
                });
            });
            // Setting the appropriate Content-Type
            res.set('Content-Type', 'text/xml');

            // Sending the feed as a response
            res.send(feed.render('rss-2.0'));
        });

    });

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/prueba', function(req, res) {
        res.render('prueba.ejs');
    });
};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}