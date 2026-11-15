create table employee
(
    id         uuid                                   not null
        constraint pk_employee
            primary key,
    firstname  varchar                                not null,
    lastname   varchar                                not null,
    email      varchar                                not null
        constraint uq_employee_email
            unique,
    age        integer                                not null
        constraint ck_employee_age_positive
            check (age > 0),
    deleted_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table skill
(
    id          uuid                                   not null
        constraint pk_skill
            primary key,
    name        varchar                                not null,
    description varchar,
    alias       varchar,
    deleted_at  timestamp with time zone,
    created_at  timestamp with time zone default now() not null,
    updated_at  timestamp with time zone default now() not null
);

create unique index uq_skill_name_lower
    on skill (lower(name::text));

create table skill_assignment
(
    id                uuid                                   not null
        constraint pk_skill_assignment
            primary key,
    employee_id       uuid                                   not null
        constraint fk_skill_assignment_employee_id_employee
            references employee,
    skill_id          uuid                                   not null
        constraint fk_skill_assignment_skill_id_skill
            references skill,
    proficiency_level integer                                not null
        constraint ck_skill_assignment_proficiency_level_range
            check ((proficiency_level >= 1) AND (proficiency_level <= 5)),
    created_at        timestamp with time zone default now() not null,
    updated_at        timestamp with time zone default now() not null,
    constraint uq_skill_assignment_employee_id
        unique (employee_id, skill_id)
);

create index ix_skill_assignment_skill_id
    on skill_assignment (skill_id);

