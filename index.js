const jsonfile = require('jsonfile');
const moment = require('moment');
const simpleGit = require('simple-git');
const random = require('random');

const FILE_PATH = './data.json';

const makeCommit=(x,y) => {
    const DATE = moment().subtract(2, 'y').add(21, 'd')
                    .add(x, 'w').add(y, 'd').format();
    const data = { 
        date:DATE 
    }
    jsonfile.writeFile(FILE_PATH, data, ()=>{
    simpleGit().add([FILE_PATH]).commit(DATE,{'--date': DATE}).push();
});
};
makeCommit(3,3);