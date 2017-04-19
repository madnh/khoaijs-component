var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    sourcemaps = require("gulp-sourcemaps");


gulp.task('khoaijs-component', function () {
    return gulp.src('component.js')
        .pipe(sourcemaps.init())
        .pipe(rename({suffix: '.min'}))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('.'));
});


gulp.task('default', ['khoaijs-component']);